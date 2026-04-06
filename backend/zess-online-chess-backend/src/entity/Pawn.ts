import { Color } from "./types/Color";
import { Position } from "./types/Position";
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

    getValidMoves(currentPos: Position, board: (Piece | null)[][]): Position[] {
        const validMoves: Position[] = [];
        const direction = this.color === "white" ? -1 : 1;

        for (const move of this.movementVectors) {
            const targetRow = currentPos.row + move.row * direction;
            const targetCol = currentPos.col + move.col;

            if (!ChessBoard.isInsideBoard(targetRow, targetCol)) {
                continue;
            }

            const targetPiece = board[targetRow]?.[targetCol] ?? null;

            if (move.row === 1 && move.col === 0) {
                if (targetPiece === null) {
                    validMoves.push({ row: targetRow, col: targetCol });
                }
                continue;
            }

            if (move.row === 2 && move.col === 0) {
                const startRow = this.color === "white" ? 6 : 1;
                const middleRow = currentPos.row + direction;

                if (
                    currentPos.row === startRow &&
                    !this._hasMoved &&
                    ChessBoard.isInsideBoard(middleRow, currentPos.col) &&
                    board[middleRow]?.[currentPos.col] === null &&
                    targetPiece === null
                ) {
                    validMoves.push({ row: targetRow, col: targetCol });
                }
                continue;
            }

            if (move.row === 1 && Math.abs(move.col) === 1) {
                if (targetPiece && targetPiece.color !== this.color) {
                    validMoves.push({ row: targetRow, col: targetCol });
                }
            }
        }

        return validMoves;
    }
}