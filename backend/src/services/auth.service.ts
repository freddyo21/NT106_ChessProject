import { InvalidCredentialException } from "../exceptions";
import * as userRepository from "../repositories/user.repository";
import { generateToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken } from "../utils/jwt-handler";
import { LoginRequestDTO, LoginRequestSchema, RegisterRequestDTO, RegisterRequestSchema, UserResponseSchema, UserSchema } from "@zess-online-chess/shared";
import { comparePassword, hashPassword } from "../utils/hash";
import { ZodError } from "zod";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

/* This is the place where authentication logic is handled */
export const login = async (data: LoginRequestDTO) => {
    try {
        const { email, password, rememberMe } = await LoginRequestSchema.parseAsync(data);

        const userRow = await userRepository.findByEmail(email);

        if (!userRow) {
            throw new InvalidCredentialException("Invalid email or password");
        }

        const isMatch = await comparePassword(password, userRow.passwordHash);
        if (!isMatch) {
            throw new InvalidCredentialException("Invalid email or password");
        }

        const parsedUser = UserSchema.parse(userRow);
        const accessToken = generateToken(parsedUser, ACCESS_TOKEN_EXPIRY);
        const refreshToken = generateRefreshToken(parsedUser.id, rememberMe ? "30d" : REFRESH_TOKEN_EXPIRY);

        const { passwordHash, ...userWithoutHash } = parsedUser;
        const safeUser = UserResponseSchema.parse(userWithoutHash);

        return { user: safeUser, accessToken, refreshToken };
    } catch (error) {
        if (
            error instanceof InvalidCredentialException ||
            error instanceof ZodError
        ) {
            throw error;
        }

        throw new Error("Authentication service failed");
    }
};

export const refreshTokens = async (refreshToken: string) => {
    const refreshTokenData = verifyRefreshToken(refreshToken);

    if (!refreshTokenData) {
        throw new InvalidCredentialException("Invalid or expired refresh token");
    }

    const user = await userRepository.findById(refreshTokenData.userId);

    if (!user) {
        revokeRefreshToken(refreshToken);
        throw new InvalidCredentialException("User not found");
    }

    const parsedUser = UserSchema.parse(user);
    const newAccessToken = generateToken(parsedUser, ACCESS_TOKEN_EXPIRY);
    const newRefreshToken = generateRefreshToken(parsedUser.id, REFRESH_TOKEN_EXPIRY);

    // Optionally revoke the old refresh token (Refresh Token Rotation)
    revokeRefreshToken(refreshToken);

    const { passwordHash, ...userWithoutHash } = parsedUser;
    const safeUser = UserResponseSchema.parse(userWithoutHash);

    return { user: safeUser, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

const SALT_ROUNDS = 13; // Vừa đủ để đảm bảo an toàn mà không quá chậm cho trải nghiệm người dùng. Có thể điều chỉnh nếu cần thiết.
export const register = async (data: RegisterRequestDTO) => {
    const parsedData = await RegisterRequestSchema.parseAsync(data);
    const { name, username, email, password, confirmPassword } = parsedData;

    if (password !== confirmPassword) {
        throw new InvalidCredentialException("Passwords do not match");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUserByEmail = await userRepository.findByEmail(normalizedEmail);
    const existingUserByUsername = await userRepository.findByUsername(username);

    if (existingUserByEmail) {
        throw new InvalidCredentialException("Email already exists");
    }

    if (existingUserByUsername) {
        throw new InvalidCredentialException("Username already exists");
    }

    const hashedPassword = await hashPassword(password, SALT_ROUNDS);
    const user = await userRepository.create({
        name,
        username,
        email: normalizedEmail,
        passwordHash: hashedPassword
    });

    const safeUser = UserResponseSchema.parse(user);

    return {
        user: safeUser
    };
};

export const logout = async (refreshToken: string) => {
    revokeRefreshToken(refreshToken);

    // Khi logout, cần đẩy refreshToken và accessToken vào Redis để blacklist cho tới khi hết hạn
};