import jwt from "jsonwebtoken";
import { JwtInvalidException } from "../exceptions";
import { Logger } from "./Logger";
import { ITokenPayload, UserResponse } from "@zess-online-chess/shared";
import { getKeys } from "./key-generator";
import ms from "ms";
import crypto from "crypto";
import {
    deleteExpiredAuthTokens,
    findValidAuthToken,
    revokeAuthToken,
    storeAuthToken
} from "../repositories/auth-token.repository";

const logger = new Logger("jwt");

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
const generateRefreshTokenString = (): string => {
    return crypto.randomBytes(32).toString("hex");
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

export const generateRefreshToken = async (userId: string, expiresIn: ms.StringValue = "7d") => {
    await deleteExpiredAuthTokens("refresh");
    const refreshTokenString = generateRefreshTokenString();
    const expiresAtMs = Date.now() + ms(expiresIn);

    await storeAuthToken(refreshTokenString, userId, "refresh", expiresAtMs);

    return refreshTokenString;
};

export const verifyRefreshToken = async (refreshToken: string): Promise<{ userId: string } | null> => {
    await deleteExpiredAuthTokens("refresh");
    return findValidAuthToken(refreshToken, "refresh");
};

export const revokeRefreshToken = async (refreshToken: string) => {
    await revokeAuthToken(refreshToken, "refresh");
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
            // Log only a short token snippet for traceability.
            tokenSnippet: `${token.substring(0, 10)}...${token.slice(-10)}`,
            originalError: ex.name,
            stack: ex.stack
        });

        // Convert all JWT-related errors to JwtInvalidException.
        throw new JwtInvalidException(`Token validation failed: ${message}`, 401, { reason });
    }
};
