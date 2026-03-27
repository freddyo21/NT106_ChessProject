import jwt, { JsonWebTokenError } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JwtInvalidException } from '../exceptions/JwtInvalidException';
import { Logger } from '../utils/Logger';
import { User } from '../entities/classes/User';

const getSecretKey = (): string => {
    const key = process.env.JWT_SECRET_KEY;

    if (!key) {
        throw new Error("JWT_SECRET_KEY is missing or empty in environment configuration.")
    }

    return key;
}

export const generateToken = (user: User, expireTime: number = 3600) => {
    const issuedAt = Number(new Date());
    const expirationTime = issuedAt + expireTime * 1000; // jwt valid for 1 hour from the issued time

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
            algorithm: "ES256",
            expiresIn: "1h"
        }
    );
}

export const validateToken = (token: string) => {
    try {
        const secret = getSecretKey();

        const decoded = jwt.verify(token, getSecretKey(), {
            algorithms: ["ES256", "ES384", "ES512"],
            clockTolerance: 30
        })

        const isRequiredClaimsExist = decoded.sub;

        if (!isRequiredClaimsExist) {
            // If the token is valid but missing required claims, consider it invalid
            throw new JwtInvalidException("Token is missing required claims.");
        }

        return decoded;
    } catch (ex: unknown) {
        Logger.fileType = "jwt";

        if (ex instanceof jwt.TokenExpiredError) {
            console.error(`Expired JWT token`);
            Logger.error(`Expired JWT token`);
        } else if (ex instanceof jwt.JsonWebTokenError) {
            console.error(`Invalid JWT token`);
            Logger.error(`Invalid JWT token`);
        } else if (ex instanceof jwt.NotBeforeError) {
            console.error(`JWT not active`);
            Logger.error(`JWT not active`);
        } else {
            console.error(`JWT error`);
            Logger.error(`JWT error: ${ex}`);
        }

        // Convert all JWT-related errors to JwtInvalidException
        // This error will be caught by the Global Error Handler and returned as 401
        throw new JwtInvalidException("Token validation failed: ");
    }
}