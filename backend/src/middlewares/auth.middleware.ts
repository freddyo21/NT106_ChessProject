import { NextFunction, Request, Response } from "express";
import { validateToken } from "../utils/jwt-handler";
import { JwtPayload } from "jsonwebtoken";
import { JwtInvalidException } from "../exceptions";
import { getBearerToken } from "../auth/jwt-verify";

type JwtRequest = Request & {
    user?: string | JwtPayload;
};

export const authMiddleware = (req: JwtRequest, next: NextFunction) => {
    const token = getBearerToken(req);

    if (!token) {
        return next(new JwtInvalidException("Missing authorization token"));
    }

    try {
        const payload = validateToken(token);
        req.user = payload;
    } catch (error) {
        return next(error);
    }

    return next();
};
