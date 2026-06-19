import type { GameResult, GameStatus, TerminationReason } from "./GameResult";
import type { TimeControlType } from "./TimeControl";

export interface GameRow {
    id: string;
    whitePlayerId: string | null;
    blackPlayerId: string | null;
    createdBy: string | null;
    winnerId: string | null;
    whiteRatingSnapshot: number | null;
    blackRatingSnapshot: number | null;
    roomCode: string | null;
    isPrivate: boolean;
    gameMode: "pvp" | "ai";
    aiLevel: number | null;
    status: GameStatus;
    result: GameResult | null;
    terminationReason: TerminationReason | null;
    currentFen: string;
    currentTurn: "white" | "black";
    moveCount: number;
    halfmoveClock: number;
    timeControlType: TimeControlType;
    initialTimeSeconds: number;
    incrementSeconds: number;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    startedAt: Date | null;
    endedAt: Date | null;
    lastMoveAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateGameData {
    whitePlayerId: string;
    blackPlayerId: string;
    createdBy: string;
    roomCode: string;
    isPrivate?: boolean;
    gameMode?: "pvp" | "ai";
    aiLevel?: number;
    timeControlType: TimeControlType;
    initialTimeSeconds: number;
    incrementSeconds: number;
    whiteRatingSnapshot?: number;
    blackRatingSnapshot?: number;
}

export interface FinishGameData {
    gameId: string;
    result: GameResult;
    terminationReason: TerminationReason;
    winnerId: string | null;
    currentFen?: string;
    moveCount?: number;
    whiteTimeLeft?: number;
    blackTimeLeft?: number;
}

export interface RecordMoveData {
    gameId: string;
    playerId: string;
    playerUsername: string;
    moveNumber: number;
    turnSide: "white" | "black";
    fromPos: string;
    toPos: string;
    pieceType: string;
    capturedPieceType?: string;
    promotionPiece?: string;
    sanNotation: string;
    uciNotation?: string;
    fenBefore: string;
    fenAfter: string;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isCastling?: boolean;
    isPromotion?: boolean;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    timeSpentSeconds: number;
}

export interface PlayerRatingRow {
    userId: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    gamesPlayed: number;
    lastRatedAt: Date;
    updatedAt: Date;
}

export interface UpdateRatingData {
    userId: string;
    newRating: number;
    result: "win" | "loss" | "draw";
}