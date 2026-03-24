import bcrypt from "bcrypt";
import { InvalidCredentialException } from "../exceptions/InvalidCredentialException";
import jwt from "jsonwebtoken";
import * as authRepository from "../repositories/auth.repository";
import * as userRepository from "../repositories/user.repository";

/* This is the place where authentication logic is handled */

export const login = async (email: string, password: string) => {
    try {
        const normalizedEmail = email.trim().toLowerCase();
        const jwtSecret = process.env.JWT_SECRET;

        if (!jwtSecret) {
            throw new Error("JWT_SECRET is not configured");
        }

        const user = await authRepository.login(normalizedEmail, password);

        if (!user) {
            throw new InvalidCredentialException("Invalid email or password");
        }

        const token = jwt.sign(
            {
                sub: String(user.id),
                email: user.email,
                iss: "zess-online-chess"
            },
            jwtSecret,
            {
                expiresIn: 3600,
                 // 1 hours
            }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email
            }
        };
    } catch (error) {
        if (error instanceof InvalidCredentialException) {
            throw error;
        }

        throw new Error("Authentication service failed");
    }
}

const SALT_ROUNDS = 13;
export const register = async (name: string, email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
        throw new InvalidCredentialException("Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await authRepository.register(normalizedEmail, hashedPassword);

    return {
        user
    };
}

export const logout = async (token: string) => {
    
};