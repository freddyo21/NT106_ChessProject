import { z } from "zod";
import { ErrorResponseSchema } from "../schemas";

export type IErrorResponse = z.infer<typeof ErrorResponseSchema>;