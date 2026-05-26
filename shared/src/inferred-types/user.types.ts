import { z } from "zod";
import * as UserSchemas from "../schemas/user.schema";

export type User = z.infer<typeof UserSchemas.UserSchema>;

// Type cho dữ liệu trả về client
export type UserResponse = z.infer<typeof UserSchemas.UserResponseSchema>;

export type CreateUserRequest = z.infer<typeof UserSchemas.CreateUserRequestSchema>;

export type UpdateUserRequest = Partial<Pick<User, "name" | "email" | "username" | "status">>;

export type ChangePasswordRequest = z.infer<typeof UserSchemas.ChangePasswordRequestSchema>;

// Backward-compatible aliases
export interface IUser extends User { };
export interface IUserResponse extends UserResponse { };
export interface ICreateUserRequest extends CreateUserRequest { };
export interface IUpdateUserRequest extends UpdateUserRequest { };
export interface IChangePasswordRequest extends ChangePasswordRequest { };