import bcrypt from "bcrypt";
import { InvalidCredentialException } from "../exceptions";
import * as userRepository from "../repositories/user.repository";
import { generateToken } from "../utils/jwt-handler";
import { LoginRequestDTO, LoginRequestSchema, RegisterRequestDTO, RegisterRequestSchema, UserResponseSchema, UserSchema } from "@zess-online-chess/shared";
import { comparePassword, hashPassword } from "../utils/hash";

const EXPIRY_SHORT = 3600;
const EXPIRY_LONG = 2592000; // 30 Ngày (3600 * 24 * 30)

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

        const token = generateToken(UserSchema.parse(userRow), rememberMe ? EXPIRY_LONG : EXPIRY_SHORT);
        const safeUser = UserResponseSchema.parse(userRow);

        return { user: safeUser, token };
    } catch (error) {
        if (error instanceof InvalidCredentialException) {
            throw error;
        }

        throw new Error("Authentication service failed");
    }
}

const SALT_ROUNDS = 13; // Vừa đủ để đảm bảo an toàn mà không quá chậm cho trải nghiệm người dùng. Có thể điều chỉnh nếu cần thiết.
export const register = async (data: RegisterRequestDTO) => {
    const parsedData = await RegisterRequestSchema.parseAsync(data);
    const { name, username, email, password, confirmPassword } = parsedData;


    if (password !== confirmPassword) {
        throw new InvalidCredentialException("Passwords do not match");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
        throw new InvalidCredentialException("Email already exists");
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
}

export const logout = async (token: string) => {
    void token;
    throw new Error("Logout is not implemented for stateless JWT authentication because token revocation/blacklisting is not configured.");
};