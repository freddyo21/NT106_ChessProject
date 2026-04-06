import { Color } from "./types/Color";
import { Position } from "./types/Position";
import { ChessBoard } from "./ChessBoard";
import { Piece } from "./Piece";

export class Rook extends Piece {
    readonly type = "rook";

    readonly movementVectors: Position[] = [
        { row: 1, col: 0 },     // Up
        { row: -1, col: 0 },    // Down
        { row: 0, col: -1 },    // Left
        { row: 0, col: 1 },     // Right
    ] as const;

    constructor(color: Color) {
        super(color);
    }

    getValidMoves(currentPos: Position, board: (Piece | null)[][]): Position[] {
        const validMoves: Position[] = [];

        for (const direction of this.movementVectors) {
            let nextRow = currentPos.row + direction.row;
            let nextCol = currentPos.col + direction.col;

            while (ChessBoard.isInsideBoard(nextRow, nextCol)) {
                const targetPiece = board[nextRow]?.[nextCol] ?? null;

                if (targetPiece === null) {
                    validMoves.push({ row: nextRow, col: nextCol });
                } else {
                    if (targetPiece.color !== this.color) {
                        validMoves.push({ row: nextRow, col: nextCol });
                    }
                    break;
                }

                nextRow += direction.row;
                nextCol += direction.col;
            }
        }

        return validMoves;
    }
}