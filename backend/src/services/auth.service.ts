import { InvalidCredentialException, ServiceUnavailableException } from "../exceptions";
import { LoginRequestDTO, LoginRequestSchema, RegisterRequestDTO, RegisterRequestSchema, UserResponseSchema, UserSchema } from "@zess-online-chess/shared";
import { randomBytes } from "node:crypto";
import { ZodError } from "zod";
import { deleteExpiredAuthTokens, storeAuthToken } from "../repositories/auth-token.repository";
import * as userRepository from "../repositories/user.repository";
import { comparePassword, hashPassword } from "../utils/hash";
import { generateRefreshToken, generateToken, revokeRefreshToken, verifyRefreshToken } from "../utils/jwt-handler";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const SALT_ROUNDS = 13;

const toSafeUser = (user: ReturnType<typeof UserSchema.parse>) => {
    const userWithoutHash = { ...user };
    delete (userWithoutHash as Partial<typeof userWithoutHash>).passwordHash;

    return UserResponseSchema.parse(userWithoutHash);
};

const isDatabaseConnectionError = (error: unknown) => {
    if (error instanceof AggregateError) {
        return error.errors.some(isDatabaseConnectionError);
    }

    if (typeof error !== "object" || error === null) {
        return false;
    }

    const code = "code" in error ? error.code : undefined;
    return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT";
};

const toAuthServiceError = (error: unknown) => {
    if (
        error instanceof InvalidCredentialException ||
        error instanceof ServiceUnavailableException ||
        error instanceof ZodError
    ) {
        return error;
    }

    if (isDatabaseConnectionError(error)) {
        return new ServiceUnavailableException("Database is not available. Please start PostgreSQL and try again.");
    }

    return new Error("Authentication service failed");
};

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
        const refreshToken = await generateRefreshToken(parsedUser.id, rememberMe ? "30d" : REFRESH_TOKEN_EXPIRY);

        const safeUser = toSafeUser(parsedUser);

        return { user: safeUser, accessToken, refreshToken };
    } catch (error) {
        throw toAuthServiceError(error);
    }
};

export const refreshTokens = async (refreshToken: string) => {
    const refreshTokenData = await verifyRefreshToken(refreshToken);

    if (!refreshTokenData) {
        throw new InvalidCredentialException("Invalid or expired refresh token");
    }

    const user = await userRepository.findById(refreshTokenData.userId);

    if (!user) {
        await revokeRefreshToken(refreshToken);
        throw new InvalidCredentialException("User not found");
    }

    const parsedUser = UserSchema.parse(user);
    const newAccessToken = generateToken(parsedUser, ACCESS_TOKEN_EXPIRY);
    const newRefreshToken = await generateRefreshToken(parsedUser.id, REFRESH_TOKEN_EXPIRY);

    // Optionally revoke the old refresh token (Refresh Token Rotation)
    await revokeRefreshToken(refreshToken);

    const safeUser = toSafeUser(parsedUser);

    return { user: safeUser, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const register = async (data: RegisterRequestDTO) => {
    try {
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
    } catch (error) {
        throw toAuthServiceError(error);
    }
};

export const logout = async (refreshToken: string) => {
    await revokeRefreshToken(refreshToken);
};

const generateResetToken = (): string => {
    return randomBytes(32).toString("hex");
};

const cleanupExpiredResetTokens = async () => {
    await deleteExpiredAuthTokens("password_reset");
};

export const forgotPassword = async (email: string) => {
    await cleanupExpiredResetTokens();
    const normalizedEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (user) {
        const resetToken = generateResetToken();
        const expiresAtMs = Date.now() + RESET_TOKEN_EXPIRY_MS;

        await storeAuthToken(resetToken, user.id, "password_reset", expiresAtMs);

        // TODO: Send reset token via email
        console.log(`Reset token for ${email}: ${resetToken}`);
    }

    return { message: "If an account with that email exists, a password reset link has been sent." };
};

export const changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
) => {
    if (newPassword !== confirmPassword) {
        throw new InvalidCredentialException("New passwords do not match");
    }

    if (!newPassword || newPassword.length < 8) {
        throw new InvalidCredentialException("New password must be at least 8 characters long");
    }

    if (currentPassword === newPassword) {
        throw new InvalidCredentialException("New password must be different from current password");
    }

    const user = await userRepository.findById(userId);
    if (!user) {
        throw new InvalidCredentialException("User not found");
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
        throw new InvalidCredentialException("Current password is incorrect");
    }

    const hashedPassword = await hashPassword(newPassword, SALT_ROUNDS);
    await userRepository.update(user.id, { passwordHash: hashedPassword });

    return { message: "Password changed successfully." };
};
