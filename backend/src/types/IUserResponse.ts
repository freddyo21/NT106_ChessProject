import z from "zod";
import { ChangePasswordRequestSchema, CreateUserRequestSchema, UserResponseSchema, UserSchema } from "@zess-online-chess/shared";

export type User = z.infer<typeof UserSchema>;

// Type cho dữ liệu trả về client
export type UserResponse = z.infer<typeof UserResponseSchema>;

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export type UpdateUserRequest = Partial<Pick<User, "name" | "email" | "username" | "status">>;

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;