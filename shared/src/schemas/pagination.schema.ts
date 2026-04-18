import { z } from "zod";
import { snakeToCamelTransform } from "../utils";

export const PaginationParamsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sort_by: z.string().optional(),
    order_by: z.enum(["asc", "desc"]).default("asc"),
})
    .strict()
    .transform(snakeToCamelTransform);