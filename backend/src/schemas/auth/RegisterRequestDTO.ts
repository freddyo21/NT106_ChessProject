import { z } from "zod";
import { BadRequestException } from "../../exceptions";
import { Logger } from "../../utils/Logger";
import { RegisterRequestDTO, RegisterRequestSchema } from "@zess-online-chess/shared";

const logger = new Logger("RegisterRequestDTO");

export const validateRegisterRequest = (data: Record<string, unknown>): RegisterRequestDTO => {
    const result = RegisterRequestSchema.safeParse(data);
    if (!result.success) {
        logger.error("Register request validation failed", {
            input: {
                ...data,
                password: typeof data.password === "string" ? "*".repeat(String(data.password).length) : undefined
            },
            error: z.treeifyError(result.error)
        });
        throw new BadRequestException("Validation Error", result.error.issues);
    }
    return result.data;
}