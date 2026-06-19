import type { TimeControlType } from "./TimeControl";

export type MatchmakingMode = "casual" | "ranked";

export interface QueueEntry {
    userId: string;
    mode: MatchmakingMode;
    timeControlType: TimeControlType;
    ratingAtQueue: number;
    createdAt: Date;
}

export interface MatchFound {
    matched: true;
    gameId: string;
    roomCode: string;
    whitePlayerId: string;
    blackPlayerId: string;
    timeControlType: TimeControlType;
    initialTimeSeconds: number;
    incrementSeconds: number;
}

export interface MatchNotFound {
    matched: false;
}

export type MatchmakingResult = MatchFound | MatchNotFound;