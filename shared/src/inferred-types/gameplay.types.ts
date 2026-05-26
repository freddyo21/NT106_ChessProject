import { z } from "zod";
import {
    ChatPayloadSchema,
    ChessMovePayloadSchema,
    ColorSchema,
    GameReadyPayloadSchema,
    JoinRoomPayloadSchema,
    LeaveRoomPayloadSchema,
    PositionSchema,
    PromotionPieceSchema,
    TimerSyncPayloadSchema,
} from "../schemas/gameplay.schema";

export type Color = z.infer<typeof ColorSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type PromotionPiece = z.infer<typeof PromotionPieceSchema>;

export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;
export type LeaveRoomPayload = z.infer<typeof LeaveRoomPayloadSchema>;
export type ChessMovePayload = z.infer<typeof ChessMovePayloadSchema>;
export type ChatPayload = z.infer<typeof ChatPayloadSchema>;
export type GameReadyPayload = z.infer<typeof GameReadyPayloadSchema>;
export type TimerSyncPayload = z.infer<typeof TimerSyncPayloadSchema>;