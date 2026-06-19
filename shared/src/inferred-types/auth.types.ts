
import { z } from "zod";
import { LoginRequestSchema, LoginResponseSchema, RegisterRequestSchema, RegisterResponseSchema, TokenResponseSchema } from "../schemas";

export type LoginRequestDTO = z.infer<typeof LoginRequestSchema>;

export type LoginResponseDTO = z.infer<typeof LoginResponseSchema>;

export type RegisterRequestDTO = z.infer<typeof RegisterRequestSchema>;

export type RegisterResponseDTO = z.infer<typeof RegisterResponseSchema>;

export type TokenResponseDTO = z.infer<typeof TokenResponseSchema>;