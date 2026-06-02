import jwt from "jsonwebtoken";
import { JwtInvalidException } from "../exceptions";
import { Logger } from "./Logger";
import { ITokenPayload, UserResponse } from "@zess-online-chess/shared";
import { getKeys } from "./key-generator";
import ms from "ms";
import crypto from "crypto";

const logger = new Logger("jwt");

type RefreshTokenRecord = {
    userId: string;
    expiresAt: number;
};

export const generateToken = (user: UserResponse, expiresIn: ms.StringValue = "15m") => {
    const issuedAt = Math.floor(Date.now() / 1000);
    
    const { privateKey } = getKeys();

    const payload: ITokenPayload = {
        iss: process.env.JWT_ISSUER,    // Issuer of the token
        sub: user.id,                   // Subject of the token
        aud: process.env.JWT_ISSUER,    // Audience of the token
        iat: issuedAt,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status
    };

    return jwt.sign(
        payload,
        privateKey,
        {
            algorithm: "ES256" as const,
            expiresIn,
        }
    );
};

// const getSecretKey = (): string => {
//     const key = process.env.JWT_SECRET_KEY; // Do not provide a default value for the secret key, as it is critical for security.
//     const hasKey = key && key.trim().length > 0; // Check if the key exists and is not just whitespace.

//     if (!hasKey) {
//         throw new JwtInvalidException("Secret key is missing or empty in environment configuration.");
//     }

//     return key;
// };

// Cần bỏ sau khi đã có Redis để blacklist refresh token
const refreshTokenStore = new Map<string, RefreshTokenRecord>();

// const getSecretKey = (): string => {
//     const key = process.env.JWT_SECRET_KEY; // Do not provide a default value for the secret key, as it is critical for security.
//     const hasKey = key && key.trim().length > 0; // Check if the key exists and is not just whitespace.

//     if (!hasKey) {
//         throw new JwtInvalidException("Secret key is missing or empty in environment configuration.");
//     }

//     return key;
// };

// Cần bỏ sau khi đã có Redis để blacklist refresh token
const cleanupExpiredRefreshTokens = () => {
    const now = Date.now();
    for (const [token, record] of refreshTokenStore.entries()) {
        if (record.expiresAt <= now) {
            refreshTokenStore.delete(token);
        }
    }
};

const generateRefreshTokenString = (): string => {
    return crypto.randomBytes(32).toString("hex");
};

export const generateRefreshToken = (userId: string, expiresIn: ms.StringValue = "7d") => {
    cleanupExpiredRefreshTokens();

    const refreshTokenString = generateRefreshTokenString();
    const expiresAtMs = Date.now() + ms(expiresIn);

    refreshTokenStore.set(refreshTokenString, {
        userId,
        expiresAt: expiresAtMs,
    });

    return refreshTokenString;
};

export const verifyRefreshToken = (refreshToken: string): { userId: string } | null => {
    cleanupExpiredRefreshTokens();

    const record = refreshTokenStore.get(refreshToken);

    if (!record) {
        return null;
    }

    if (record.expiresAt <= Date.now()) {
        refreshTokenStore.delete(refreshToken);
        return null;
    }

    return { userId: record.userId };
};

export const revokeRefreshToken = (refreshToken: string) => {
    refreshTokenStore.delete(refreshToken);
};

export const validateToken = (token: string) => {
    try {
        const { publicKey } = getKeys();

        const decoded = jwt.verify(token, publicKey, {
            algorithms: ["ES256"],
            clockTolerance: 30
        }) as ITokenPayload;

        const isRequiredClaimsExist = decoded.sub;

        if (!isRequiredClaimsExist) {
            // If the token is valid but missing required claims, consider it invalid
            throw new JwtInvalidException("Token is missing required claims.");
        }

        return decoded;
    } catch (ex: any) {
        let message = "Token validation failed";
        let reason = "Unknown JWT error";

        if (ex instanceof jwt.TokenExpiredError) {
            message = "Token has expired";
            reason = "TokenExpiredError";
        } else if (ex instanceof jwt.JsonWebTokenError) {
            message = "Token is invalid or has been tampered with";
            reason = "JsonWebTokenError";
        } else if (ex instanceof jwt.NotBeforeError) {
            message = "Token is not yet valid (not active)";
            reason = "NotBeforeError";
        }

        logger.error(`[JWT_FAILED] ${reason}: ${ex.message || message}`, {
            // Log 10 ký tự đầu/cuối là đủ trace
            tokenSnippet: `${token.substring(0, 10)}...${token.slice(-10)}`,
            originalError: ex.name,
            // stack: reason === "Unknown JWT error" && ex.stack ? ex.stack : undefined
            stack: ex.stack
        });

        // Convert all JWT-related errors to JwtInvalidException
        // This error will be caught by the Global Error Handler and returned as 401
        throw new JwtInvalidException(`Token validation failed: ${message}`, 401, { reason });
    }
};
