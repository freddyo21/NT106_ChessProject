import { Color } from "../types/Color";
import { Position } from "../types/Position";
import { ChessBoard } from "./ChessBoard";
import { Piece } from "./Piece";

export class Queen extends Piece {
    readonly type = "queen" as const;

    readonly movementVectors: Position[] = [
        { row: 1, col: 0 },     // Up
        { row: -1, col: 0 },    // Down
        { row: 0, col: 1 },     // Right
        { row: 0, col: -1 },    // Left
        { row: -1, col: 1 },    // Down-Right
        { row: -1, col: -1 },   // Down-Left
        { row: 1, col: 1 },     // Up-Right
        { row: 1, col: -1 },    // Up-Left
    ] as const;

    constructor(color: Color) {
        super(color);
    }

    getValidMoves(currentPos: Position, board: (Piece | null)[][]): Position[] {
        const validMoves: Position[] = [];

        for (const direction of this.movementVectors) {
            let y = currentPos.row + direction.row;
            let x = currentPos.col + direction.col;

            while (ChessBoard.isInsideBoard(y, x)) {
                const targetPiece = board[y]?.[x] ?? null;

                if (targetPiece === null) {
                    validMoves.push({ row: y, col: x });
                } else {
                    if (targetPiece.color !== this.color) {
                        validMoves.push({ row: y, col: x });
                    }
                    break;
                }

                y += direction.row;
                x += direction.col;
            }
        }

        return validMoves;
    }
}