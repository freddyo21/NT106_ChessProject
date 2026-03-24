import { Request, Response } from 'express';
import * as authService from "../services/auth.service";
import { InvalidCredentialException } from '../exceptions/InvalidCredentialException';

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
        return res.status(400).json({
            message: "Email and password are required."
        });
    }

    try {
        const result = await authService.login(email, password);

        if (!result) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        res.status(200).send({
            message: "Logged in successfully.",
            token: "fake-jwt-token", // Replace with actual token generation logic,
            user: result.user
        });
    } catch (error) {
        console.error("Login failed:", error);

        return res.status(500).json({
            message: "Internal server error."
        });
    }
}

export const register = async (req: Request, res: Response) => {
    const {
        name,
        email,
        password,
        confirmPassword
    } = req.body;

    // Need to check existing user

    //

    if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({
            message: "Email and password are required."
        });
    }

    if (!email.trim() || password.length < 6) {
        return res.status(400).json({
            message: "Email must be valid and password must be at least 6 characters."
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({
            message: "Password and confirmation password do not match."
        });
    }

    try {
        const result = await authService.register(
            name,
            email,
            password
        );

        return res.status(201).json({
            message: "Registered successfully.",
            user: result.user
        });
    } catch (error) {
        if (error instanceof InvalidCredentialException) {
            return res.status(409).json({
                message: error.message
            });
        }

        console.error("Register failed:", error);

        return res.status(500).json({
            message: "Internal server error."
        });
    }
}

export const logout = async (req: Request, res: Response) => {
    
};