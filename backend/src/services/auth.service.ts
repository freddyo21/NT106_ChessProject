import { Exception, InvalidCredentialException } from "../exceptions";
import * as userRepository from "../repositories/user.repository";
import { generateToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken } from "../utils/jwt-handler";
import { LoginRequestDTO, LoginRequestSchema, RegisterRequestDTO, RegisterRequestSchema, UserResponseSchema, UserSchema } from "@zess-online-chess/shared";
import { comparePassword, hashPassword } from "../utils/hash";
import { ZodError } from "zod";
import crypto from "crypto";
import ms from "ms";

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
        const refreshToken = await generateRefreshToken(parsedUser.id, rememberMe ? "30d" : REFRESH_TOKEN_EXPIRY);

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

        throw new Exception("Authentication service failed");
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

// Store for password reset tokens (should use Redis in production)
const resetTokenStore = new Map<string, { userId: string; expiresAt: number }>();

const RESET_TOKEN_EXPIRY = ms("15m"); // 15 minutes

const generateResetToken = (): string => {
    return crypto.randomBytes(32).toString("hex");
};

const cleanupExpiredResetTokens = () => {
    const now = Date.now();
    for (const [token, record] of resetTokenStore.entries()) {
        if (record.expiresAt <= now) {
            resetTokenStore.delete(token);
        }
    }
};

export const forgotPassword = async (email: string) => {
    cleanupExpiredResetTokens();
    const normalizedEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (user) {
        const resetToken = generateResetToken();
        const expiresAtMs = Date.now() + RESET_TOKEN_EXPIRY * 60 * 1000;

        resetTokenStore.set(resetToken, {
            userId: user.id,
            expiresAt: expiresAtMs,
        });

        // TODO: Send reset token via email
        // Example: await mailerService.sendPasswordResetEmail(user.email, resetToken);
        console.log(`Reset token for ${email}: ${resetToken}`);
    }

    // Return generic message to avoid email enumeration
    return { message: "If an account with that email exists, a password reset link has been sent." };
};

// export const resetPassword = async (
//     token: string,
//     newPassword: string,
//     confirmPassword: string
// ) => {
//     if (newPassword !== confirmPassword) {
//         throw new InvalidCredentialException("Passwords do not match");
//     }

//     if (!newPassword || newPassword.length < 8) {
//         throw new InvalidCredentialException("Password must be at least 8 characters long");
//     }

//     cleanupExpiredResetTokens();

//     const resetRecord = resetTokenStore.get(token);
//     if (!resetRecord) {
//         throw new InvalidCredentialException("Invalid or expired reset token");
//     }

//     if (resetRecord.expiresAt <= Date.now()) {
//         resetTokenStore.delete(token);
//         throw new InvalidCredentialException("Reset token has expired");
//     }

//     const user = await userRepository.findById(resetRecord.userId);
//     if (!user) {
//         throw new InvalidCredentialException("User not found");
//     }

//     const hashedPassword = await hashPassword(newPassword, SALT_ROUNDS);
//     await userRepository.update(user.id, { passwordHash: hashedPassword });

//     // Invalidate all refresh tokens to force re-login
//     // TODO: Implement refresh token revocation for this user

//     resetTokenStore.delete(token);

//     return { message: "Password reset successfully. Please log in with your new password." };
// };

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

    // Optionally invalidate all refresh tokens to force re-login on all devices
    // TODO: Implement refresh token revocation for this user

    return { message: "Password changed successfully." };
};
