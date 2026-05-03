import { z } from "zod";

export const SuccessResponseSchema = z.object({
    message: z.string().optional(),
    data: z.record(
        z.string(),
        z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.record(z.string(), z.any()),
            z.null(),
            z.array(z.string()),
            z.array(z.number()),
            z.array(z.boolean()),
            z.object({}).loose()
        ])
    ).optional(),
});