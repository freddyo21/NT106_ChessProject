import { Request } from "express";
import { JwtInvalidException } from "../exceptions";
import * as JwtHandler from "../utils/jwt-handler";

export const jwtVerify = (token: string) => {
    if (!token) throw new JwtInvalidException("Invalid authorization token");

    const user = JwtHandler.validateToken(token);

    if (!user) {
        throw new JwtInvalidException("Unauthorized: Invalid or expired token");
    }

    return user;
};

export const getBearerToken = (req: Request) => {
    const authorizationHeader = req.get("Authorization") || req.headers.authorization;

    if (!authorizationHeader) {
        return null;
    }

    const matches = authorizationHeader.match(/^Bearer\s+(\S+)$/i);

    return matches ? matches[1] : null;
};