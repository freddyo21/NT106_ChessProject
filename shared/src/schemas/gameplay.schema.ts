import { z } from "zod";

export const ColorSchema = z.enum(["white", "black"]);

export const PositionSchema = z.object({
    row: z.number().int().min(0).max(7),
    col: z.number().int().min(0).max(7),
}).strict();

export const PromotionPieceSchema = z.enum(["queen", "rook", "bishop", "knight"]);

export const JoinRoomPayloadSchema = z.object({
    roomId: z.string().min(1, "roomId is required"),
}).strict();

export const LeaveRoomPayloadSchema = JoinRoomPayloadSchema;

export const ChessMovePayloadSchema = z.object({
    roomId: z.string().min(1, "roomId is required"),
    from: PositionSchema,
    to: PositionSchema,
    promotionPiece: PromotionPieceSchema.optional(),
}).strict();

export const ChatPayloadSchema = z.object({
    roomId: z.string().min(1).optional(),
    message: z.string().trim().min(1).max(500),
}).strict();

export const GameReadyPayloadSchema = z.object({
    roomId: z.string().min(1, "roomId is required"),
    gameId: z.string().min(1).optional(),
}).strict();

export const TimerSyncPayloadSchema = z.object({
    roomId: z.string().min(1, "roomId is required"),
}).strict();

export const InvitationParametersSchema = z.object({
    rid: z.uuidv7("Invalid room ID format")
        .min(1, "Room ID is required")
        .refine((val) => val.trim() !== "", "Room ID cannot be empty")
        .refine((val) => /^[0-9a-fA-F-]+$/.test(val), "Room ID must be a valid UUID")
}).strict();