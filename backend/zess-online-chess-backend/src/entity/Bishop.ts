import { Color } from "./types/Color";
import { Position } from "./types/Position";
import { ChessBoard } from "./ChessBoard";
import { Piece } from "./Piece";

export class Bishop extends Piece {
    readonly type = "bishop";

    readonly movementVectors: Position[] = [
        { row: 1, col: 1 },   // Up-right
        { row: 1, col: -1 },  // Up-left
        { row: -1, col: 1 },    // Down-right
        { row: -1, col: -1 },   // Down-left
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
