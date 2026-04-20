import { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service";
import { validateLoginRequest } from "../schemas/auth/LoginRequestDTO";
import { validateRegisterRequest } from "../schemas/auth/RegisterRequestDTO";
import { LoginResponseDTO } from "@zess-online-chess/shared";
import { ForbiddenException, InvalidCredentialException } from "../exceptions";

const EXPIRY_SHORT = 3600;
const EXPIRY_LONG = 2592000; // 30 Ngày (3600 * 24 * 30)

export const login = async (req: Request, res: Response<LoginResponseDTO>, next: NextFunction) => {
    try {
        const { ...loginData } = req.body;

        const cleanData = validateLoginRequest(loginData);

        const { user, token } = await authService.login(cleanData);

        if (!user) {
            throw new InvalidCredentialException("Invalid email or password.");
        }

        if (!user.isVerified) {
            throw new ForbiddenException("Your account is not verified. Please check your email for verification instructions.");
        }

        return res.status(200).json({
            message: "Logged in successfully.",
            accessToken: token,
            refreshToken: "", // Add refresh token from authService if available
            expiresIn: cleanData.rememberMe ? EXPIRY_LONG : EXPIRY_SHORT,
            user: { ...user, isVerified: true }
        });
    } catch (err) {
        next(err);
    }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ...registerData } = req.body;

        const cleanData = validateRegisterRequest(registerData);

        const { user } = await authService.register(cleanData);

        return res.status(201).json({
            status: "success",
            message: "Registered successfully.",
            data: {
                user
            }
        });
    } catch (error) {
        next(error);
    }
};

export const logout = async (req: Request, res: Response) => {
    return res.sendStatus(204);
};