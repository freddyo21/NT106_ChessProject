import { z } from "zod";
import * as UserSchemas from "../schemas/user.schema";

export type BaseUser = z.infer<typeof UserSchemas.BaseUserSchema>;

export type User = z.infer<typeof UserSchemas.UserSchema>;

export type UserRole = z.infer<typeof UserSchemas.UserRoleSchema>;

// Type cho dữ liệu trả về client
export type UserResponse = z.infer<typeof UserSchemas.UserResponseSchema>;

export type CreateUserRequest = z.infer<typeof UserSchemas.CreateUserRequestSchema>;

export type UpdateUserRequest = Partial<Pick<User, "name" | "email" | "username" | "status">>;

export type ChangePasswordRequest = z.infer<typeof UserSchemas.ChangePasswordRequestSchema>;

// Backward-compatible aliases
export interface IBaseUser extends BaseUser { };
export interface IUser extends User { };
export interface IUserRole extends UserRole { };
export interface IUserResponse extends UserResponse { };
export interface ICreateUserRequest extends CreateUserRequest { };
export interface IUpdateUserRequest extends UpdateUserRequest { };
export interface IChangePasswordRequest extends ChangePasswordRequest { };