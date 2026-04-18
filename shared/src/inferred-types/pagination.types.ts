import { z } from "zod";
import { PaginationParamsSchema } from "../schemas/pagination.schema";

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;