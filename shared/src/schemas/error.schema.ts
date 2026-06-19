import { z } from "zod";

export const ErrorResponseSchema = z.object({
    status: z.string().min(1),
    error: z.object({
        name: z.string().min(1),
        message: z.string().min(1),
        stack: z.string().optional(),
        details: z.record(
            z.string(),
            z.union([
                z.string(),
                z.record(z.string(), z.any()),
                z.number(),
                z.boolean(),
                z.null(),
                z.array(z.string()),
                z.unknown()
            ])
        ).optional(),
        path: z.string().min(1),
        timestamp: z.iso.datetime(),
    }),
});