import type { PieceColor } from "./GameResult";
import type { TimeControlType } from "./TimeControl";

export interface TimeControl {
    type: TimeControlType;
    initialTimeSeconds: number;
    incrementSeconds: number;
}

export interface TimerSnapshot {
    whiteTimeLeft: number;
    blackTimeLeft: number;
    currentTurn: PieceColor;
    updatedAt: number;
}