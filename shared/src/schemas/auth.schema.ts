import { z } from "zod";
import { UserResponseSchema } from "./";

const AuthBaseResponseSchema = z.object({
    message: z.string(),
    user: UserResponseSchema.partial() // Cho phép user có thể trả về null hoặc undefined nếu chưa xác thực email
});

export const LoginRequestSchema = z.object({
    email: z
        .email({ message: "Invalid email format" })
        .trim()
        .toLowerCase()
        .min(1, { message: "Email cannot be empty" })
        .max(100, { message: "Email cannot exceed 100 characters" }),
    password: z
        .string()
        .min(8, { message: "Password must be at least 8 characters long" })
        // .regex(/[a-z]/, { message: "Requires at least 1 lowercase letter" })
        // .regex(/[A-Z]/, { message: "Requires at least 1 uppercase letter" })
        // .regex(/[0-9]/, { message: "Requires at least 1 number" })
        // .regex(/[^a-zA-Z0-9]/, { message: "Requires at least 1 special character" })
        .refine((val) => !val.includes("123456"), {
            message: "Password is too weak, don't use consecutive sequences!",
        }),
    rememberMe: z.boolean().default(false).optional()
}).strict();

export const LoginResponseSchema = AuthBaseResponseSchema.extend({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
    user: UserResponseSchema.extend({
        isVerified: z.literal(true)
    })
});

export const RegisterRequestSchema = z.object({
    name: z
        .string()
        .min(2, { message: "Name cannot be empty" })
        .max(50, { message: "Name cannot exceed 50 characters" }),
    email: z
        .email({ message: "Invalid email format" })
        .trim()
        .toLowerCase()
        .min(1, { message: "Email cannot be empty" })
        .max(75, { message: "Email cannot exceed 75 characters" }),
    username: z
        .string()
        .min(2, { message: "Username cannot be empty" })
        .max(50, { message: "Username cannot exceed 50 characters" }),
    password: z
        .string()
        .min(8, { message: "Password must be at least 8 characters long" })
        // .regex(/[a-z]/, { message: "Requires at least 1 lowercase letter" })
        // .regex(/[A-Z]/, { message: "Requires at least 1 uppercase letter" })
        // .regex(/[0-9]/, { message: "Requires at least 1 number" })
        // .regex(/[^a-zA-Z0-9]/, { message: "Requires at least 1 special character" })
        .refine((val) => !val.includes("123456"), {
            message: "Password is too weak, don't use consecutive sequences!",
        }),
    confirmPassword: z
        .string()
        .min(1, { message: "Confirm password cannot be empty" })
}).strict()
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

export const RegisterResponseSchema = AuthBaseResponseSchema.extend({ // Phải xác thực email trước khi đăng nhập
    user: UserResponseSchema.extend({
        isVerified: z.literal(false)
    })
});

export const TokenResponseSchema = z.object({
    accessToken: z.string(),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number(),
    user: UserResponseSchema.strict()
});