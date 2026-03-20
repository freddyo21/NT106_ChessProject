import { Color } from "../types/Color";
import { Position } from "../types/Position";
import { ChessBoard } from "./ChessBoard";
import { Piece } from "./Piece";

export class Pawn extends Piece {
    readonly type = "pawn";

    readonly movementVectors = [
        { row: 1, col: 0 },     // forward
        { row: 2, col: 0 },     // double forward (only from starting position)
        { row: 1, col: -1 },    // capture left
        { row: 1, col: 1 },     // capture right
    ];

    constructor(color: Color) {
        super(color);
    }

    // getValidMoves(currentPos: Position, board: (Piece | null)[][]): Position[] {
    //     const moves: Position[] = [];
    //     const direction = this.color === "white" ? 1 : -1; // White moves up, black moves down

    //     // Forward move
    //     const forwardY = currentPos.row + direction;

    //     if (forwardY >= 0 && forwardY < 8) {
    //         // Check if the square in front is empty
    //         if (!board[forwardY]?.[currentPos.col]) {
    //             moves.push({ row: forwardY, col: currentPos.col });

    //             // Check for double move from starting position
    //             if (!this._hasMoved) {
    //                 const doubleForwardY = currentPos.row + 2 * direction;
    //                 if (ChessBoard.isInsideBoard(doubleForwardY, currentPos.col) && !board[doubleForwardY]?.[currentPos.col]) {
    //                     moves.push({ row: doubleForwardY, col: currentPos.col });
    //                 }

    //             }
    //         }

    //         // Capture moves
    //         for (const capture of [1, -1]) {
    //             const captureX = currentPos.col + capture;
    //             if (ChessBoard.isInsideBoard(forwardY, captureX)) {
    //                 const targetPiece = board[forwardY]?.[captureX];
    //                 if (targetPiece && targetPiece.color !== this.color) {
    //                     moves.push({ row: forwardY, col: captureX });
    //                 }
    //             }
    //         }
    //     }

    //     return moves;
    // }

    getValidMoves(currentPos: Position, board: (Piece | null)[][]): Position[] {
        const validMoves: Position[] = [];
        const direction = this.color === "white" ? 1 : -1;

        for (const move of this.movementVectors) {
            const targetRow = currentPos.row + move.row * direction;
            const targetCol = currentPos.col + move.col;

            if (!ChessBoard.isInsideBoard(targetRow, targetCol)) {
                continue;
            }

            const targetPiece = board[targetRow]?.[targetCol] ?? null;

            // Forward move
            if (move.row === 1 && move.col === 0) {
                if (targetPiece === null) {
                    validMoves.push({ row: targetRow, col: targetCol });
                }
                continue;
            }

            // Double forward move
            if (move.row === 2 && move.col === 0) {
                const middleRow = currentPos.row + direction;
                const middlePiece = board[middleRow]?.[currentPos.col] ?? null;

                const startRow = this.color === "white" ? 1 : 6;

                if (
                    !this._hasMoved &&
                    currentPos.row === startRow &&
                    ChessBoard.isInsideBoard(middleRow, currentPos.col) &&
                    !middlePiece &&
                    !targetPiece
                ) {
                    validMoves.push({ row: targetRow, col: targetCol });
                }
                continue;
            }

            // Capture move
            if (move.row === 1 && Math.abs(move.col) === 1) {
                if (targetPiece && targetPiece.color !== this.color) {
                    validMoves.push({ row: targetRow, col: targetCol });
                }
            }
        }

        return validMoves;
    }
}