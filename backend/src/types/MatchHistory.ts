import type { GameResult, TerminationReason } from "./GameResult";

export interface MatchHistoryItem {
    gameId: string;
    opponentId: string;
    opponentUsername: string;
    opponentAvatar: string | null;
    opponentRatingAtGame: number | null;
    playerColor: "white" | "black";
    result: "win" | "loss" | "draw";
    gameResult: GameResult;
    terminationReason: TerminationReason | null;
    timeControlType: string;
    initialTimeSeconds: number;
    incrementSeconds: number;
    moveCount: number;
    ratingBefore: number | null;
    ratingAfter: number | null;
    ratingChange: number | null;
    startedAt: Date | null;
    endedAt: Date | null;
    durationSeconds: number | null;
}

export interface MatchHistoryOptions {
    limit?: number;
    offset?: number;
    timeControlType?: string;
}