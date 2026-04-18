import { z } from "zod";
import { UserAuthSchema } from "./";
import { snakeToCamelTransform } from "../utils";

const AuthBaseResponseSchema = z.object({
    message: z.string(),
    user: UserAuthSchema
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
        .regex(/[a-z]/, { message: "Requires at least 1 lowercase letter" })
        .regex(/[A-Z]/, { message: "Requires at least 1 uppercase letter" })
        .regex(/[0-9]/, { message: "Requires at least 1 number" })
        .regex(/[^a-zA-Z0-9]/, { message: "Requires at least 1 special character" })
        .refine((val) => !val.includes("123456"), {
            message: "Password is too weak, don't use consecutive sequences!",
        }),
    remember_me: z.boolean().default(false)
}).strict().transform(snakeToCamelTransform);

export const LoginResponseSchema = AuthBaseResponseSchema.extend({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number(),
    user: UserAuthSchema.extend({
        is_verified: z.literal(true)
    })
}).transform(snakeToCamelTransform);

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
        .regex(/[a-z]/, { message: "Requires at least 1 lowercase letter" })
        .regex(/[A-Z]/, { message: "Requires at least 1 uppercase letter" })
        .regex(/[0-9]/, { message: "Requires at least 1 number" })
        .regex(/[^a-zA-Z0-9]/, { message: "Requires at least 1 special character" })
        .refine((val) => !val.includes("123456"), {
            message: "Password is too weak, don't use consecutive sequences!",
        }),
    confirm_password: z
        .string()
        .min(1, { message: "Confirm password cannot be empty" })
}).strict()
    .refine((data) => data.password === data.confirm_password, {
        message: "Passwords don't match",
        path: ["confirm_password"],
    })
    .transform(snakeToCamelTransform);

export const RegisterResponseSchema = AuthBaseResponseSchema.extend({ // Phải xác thực email trước khi đăng nhập
    user: UserAuthSchema.extend({
        is_verified: z.literal(false)
    })
}).transform(snakeToCamelTransform);

export const TokenResponseSchema = z.object({
    accessToken: z.string(),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number(),
    user: UserAuthSchema.strict()
})
    .transform(snakeToCamelTransform);