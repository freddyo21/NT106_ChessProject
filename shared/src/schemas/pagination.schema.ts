import { z } from "zod";

export const PaginationParamsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.string().optional(),
    orderBy: z.enum(["asc", "desc"]).default("asc"),
})
    .strict();