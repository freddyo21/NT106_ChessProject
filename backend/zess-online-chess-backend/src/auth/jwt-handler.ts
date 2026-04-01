import jwt from 'jsonwebtoken';
import { JwtInvalidException } from '../exceptions/JwtInvalidException';
import { Logger } from '../utils/Logger';
import { User } from '../entities/classes/User';

const logger = new Logger("jwt");

const getSecretKey = (): string => {
    const key = process.env.JWT_SECRET_KEY; // Do not provide a default value for the secret key, as it is critical for security.
    const hasKey = key && key.trim().length > 0; // Check if the key exists and is not just whitespace.

    if (!hasKey) {
        throw new Error("Secret key is missing or empty in environment configuration.")
    }

    return key;
}

export const generateToken = (user: User, expireTime: number = 3600) => {
    const issuedAt = Number(new Date());

    const payload = {
        iss: process.env.JWT_ISSUER,    // Issuer of the token
        sub: user.id,                   // Subject of the token
        aud: process.env.JWT_ISSUER,    // Audience of the token
        iat: issuedAt
    };

    return jwt.sign(
        payload,
        getSecretKey(),
        {
            algorithm: "HS512" as const,
            expiresIn: expireTime
        }
    );
}

export const validateToken = (token: string) => {
    try {
        const secret = getSecretKey();

        const decoded = jwt.verify(token, secret, {
            algorithms: ["HS256", "HS384", "HS512"],
            clockTolerance: 30
        })

        const isRequiredClaimsExist = decoded.sub;

        if (!isRequiredClaimsExist) {
            // If the token is valid but missing required claims, consider it invalid
            throw new JwtInvalidException("Token is missing required claims.");
        }

        return decoded;
    } catch (ex: unknown) {
        logger.fileType = "jwt";

        if (ex instanceof jwt.TokenExpiredError) {
            console.error(`Token has expired`);
            logger.error(`Token has expired`);
        } else if (ex instanceof jwt.JsonWebTokenError) {
            console.error(`Invalid token`);
            logger.error(`Invalid token`);
        } else if (ex instanceof jwt.NotBeforeError) {
            console.error(`Token has not become active yet`);
            logger.error(`Token has not become active yet`);
        } else {
            console.error(`JWT error`);
            logger.error(`JWT error: ${ex}`);
        }

        // Convert all JWT-related errors to JwtInvalidException
        // This error will be caught by the Global Error Handler and returned as 401
        throw new JwtInvalidException("Token validation failed.");
    }
}