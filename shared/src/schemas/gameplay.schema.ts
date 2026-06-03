import { z } from "zod";

export const invitationParametersSchema = z.object({
    rid: z.uuidv7("Invalid room ID format")
        .min(1, "Room ID is required")
        .refine((val) => val.trim() !== "", "Room ID cannot be empty")
        .refine((val) => /^[0-9a-fA-F-]+$/.test(val), "Room ID must be a valid UUID")
}).strict();