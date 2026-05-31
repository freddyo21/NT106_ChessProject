import type { GameResult, PieceColor, TerminationReason } from "./GameResult";

export type GameOverStatus =
    | { over: false }
    | { over: true; result: GameResult; reason: TerminationReason };

export interface GameOverResult {
    result: GameResult;
    reason: TerminationReason;
    winnerId: string | null;
    whiteRatingBefore: number;
    blackRatingBefore: number;
    whiteRatingAfter: number;
    blackRatingAfter: number;
    whiteRatingChange: number;
    blackRatingChange: number;
}

export interface IChessBoard {
    getGameStatus(): string;
    getCurrentTurn(): PieceColor;
    isInsufficientMaterial(): boolean;
    isFiftyMoveRule(): boolean;
}