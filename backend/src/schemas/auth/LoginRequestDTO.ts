import { z } from "zod";
import { BadRequestException } from "../../exceptions";
import { Logger } from "../../utils/Logger";
import { LoginRequestDTO, LoginRequestSchema } from "@zess-online-chess/shared";

const logger = new Logger("LoginRequestDTO");

export const validateLoginRequest = (data: Record<string, unknown>): LoginRequestDTO => {
    const result = LoginRequestSchema.safeParse(data);

    if (!result.success) {
        logger.error("Login request validation failed", {
            input: {
                ...data,
                password: typeof data.password === "string"
                    ? "*".repeat(String(data.password).length)
                    : undefined
            },
            error: z.treeifyError(result.error)
        });

        throw new BadRequestException("Invalid input data", result.error.issues);
    }

    return result.data;
};