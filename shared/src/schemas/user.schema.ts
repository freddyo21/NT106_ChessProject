import { z } from "zod";
import { ERoles } from "../types";

export const UserSchema = z.object({
    id: z.uuidv7(),
    name: z.string()
        .min(2, { message: "Name cannot be empty" })
        .max(50, { message: "Name cannot exceed 50 characters" }),
    email: z.email({ message: "Invalid email format" })
        .trim()
        .toLowerCase()
        .min(1, { message: "Email cannot be empty" })
        .max(100, { message: "Email cannot exceed 100 characters" }),
    username: z
        .string()
        .min(2, { message: "Username cannot be empty" })
        .max(50, { message: "Username cannot exceed 50 characters" })
        .regex(/^[a-zA-Z0-9]+$/, { message: "Username must contain only letters and numbers" }),
    passwordHash: z.string().min(8), // Trường nhạy cảm
    elo: z.number()
        .int()
        .min(0)
        .default(1200),
    role: z.enum(ERoles).default(ERoles.GUEST),
    status: z.enum(["active", "inactive", "pending", "banned"]).default("active"),
    isVerified: z.boolean().default(false),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastLogin: z.date().nullable()
}).strict();

export const UserResponseSchema = UserSchema.omit({
    passwordHash: true
});

export const CreateUserRequestSchema = UserSchema.omit({
    id: true,
    passwordHash: true,
    createdAt: true,
    updatedAt: true,
    lastLogin: true
}).extend({
    password: z.string().min(8), // Client gửi pass thô, không phải hash
}).strict();

export const UpdateUserRequestSchema = UserSchema.pick({
    name: true,
    status: true
}).partial().strict();

export const ChangePasswordRequestSchema = z.object({
    oldPassword: z.string().min(1), // Không cần min(8) ở đây, cứ có là được để check
    newPassword: z.string()
        .min(8, "New password must be at least 8 characters")
        .max(50, "Password too long"),
    confirmPassword: z.string()
}).strict().refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"], // Báo lỗi đúng vào field confirm
}).refine((data) => data.oldPassword !== data.newPassword, {
    message: "New password must be different from the old one",
    path: ["newPassword"],
});