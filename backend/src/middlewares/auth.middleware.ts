import { NextFunction, Request, Response } from "express";
import { validateToken } from "../utils/jwt-handler";
import { JwtInvalidException } from "../exceptions";
import { getBearerToken } from "../auth/jwt-verify";
import { ITokenPayload } from "@zess-online-chess/shared";

type JwtRequest = Request & {
    user?: ITokenPayload & { id: string };
};

export const authMiddleware = (req: JwtRequest, _res: Response, next: NextFunction) => {
    const token = getBearerToken(req);

    if (!token) {
        return next(new JwtInvalidException("Missing authorization token"));
    }

    try {
        const payload = validateToken(token);

        if (!payload.sub) {
            return next(new JwtInvalidException("Invalid authorization token"));
        }

        req.user = {
            ...payload,
            id: payload.sub,
        };

        return next();
    } catch (error) {
        return next(error);
    }
};
