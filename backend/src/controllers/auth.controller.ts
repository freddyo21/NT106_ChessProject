import { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service";
import { validateLoginRequest } from "../schemas/auth/LoginRequestDTO";
import { validateRegisterRequest } from "../schemas/auth/RegisterRequestDTO";
import { LoginResponseDTO, UserResponseSchema } from "@zess-online-chess/shared";
import { InvalidCredentialException } from "../exceptions";

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes

export const login = async (req: Request, res: Response<LoginResponseDTO>, next: NextFunction) => {
    try {
        const { ...loginData } = req.body;

        const cleanData = validateLoginRequest(loginData);

        const { user, accessToken, refreshToken } = await authService.login(cleanData);

        if (!user) {
            throw new InvalidCredentialException("Invalid email or password.");
        }

        return res.status(200).json({
            message: "Logged in successfully.",
            accessToken,
            refreshToken,
            expiresIn: ACCESS_TOKEN_EXPIRY,
            user: { ...UserResponseSchema.parse(user), isVerified: true }
        });
    } catch (err) {
        next(err);
    }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken || typeof refreshToken !== "string") {
            throw new InvalidCredentialException("Missing or invalid refresh token");
        }

        const { user, accessToken, refreshToken: newRefreshToken } = await authService.refreshTokens(refreshToken);

        return res.status(200).json({
            message: "Tokens refreshed successfully.",
            accessToken,
            refreshToken: newRefreshToken,
            expiresIn: ACCESS_TOKEN_EXPIRY,
            user: UserResponseSchema.parse(user)
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
            message: "Registered successfully.",
            user: UserResponseSchema.parse(user)
        });
    } catch (error) {
        next(error);
    }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            await authService.logout(refreshToken);
        }

        return res.status(200).json({ message: "Logged out successfully." });
    } catch (err) {
        next(err);
    }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== "string") {
            throw new InvalidCredentialException("Missing or invalid email");
        }

        const result = await authService.forgotPassword(email);

        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = (req as any).user?.sub; // JWT subject is the authenticated user id.

        if (!userId) {
            throw new InvalidCredentialException("User not authenticated");
        }

        if (!currentPassword || typeof currentPassword !== "string") {
            throw new InvalidCredentialException("Missing or invalid current password");
        }

        if (!newPassword || typeof newPassword !== "string") {
            throw new InvalidCredentialException("Missing or invalid new password");
        }

        if (!confirmPassword || typeof confirmPassword !== "string") {
            throw new InvalidCredentialException("Missing or invalid confirm password");
        }

        const result = await authService.changePassword(userId, currentPassword, newPassword, confirmPassword);

        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
