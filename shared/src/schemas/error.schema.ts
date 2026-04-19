import { z } from "zod";
import { snakeToCamelTransform } from "../utils";

export const ErrorResponseSchema = z.object({
    status: z.string().min(1),
    error: z.object({
        name: z.string().min(1),
        message: z.string().min(1),
        stack: z.string().optional(),
        details: z.record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
        ).optional(),
        path: z.string().min(1),
        timestamp: z.iso.datetime(),
    }),
}).transform(snakeToCamelTransform);