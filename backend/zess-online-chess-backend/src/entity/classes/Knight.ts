import { Color } from "../types/Color";
import { Position } from "../types/Position";
import { ChessBoard } from "./ChessBoard";
import { Piece } from "./Piece";

export class Knight extends Piece {
    readonly type = "knight";

    readonly movementVectors = [
        { row: 2, col: 1 },     // up-right
        { row: 2, col: -1 },    // up-left
        { row: -2, col: 1 },    // down-right
        { row: -2, col: -1 },   // down-left
        { row: 1, col: 2 },     // right-up
        { row: 1, col: -2 },    // left-up
        { row: -1, col: 2 },    // right-down
        { row: -1, col: -2 },   // left-down
    ];

    constructor(color: Color) {
        super(color);
    }

    getValidMoves(currentPos: Position, board: (Piece | null)[][]): Position[] {
        const moves: Position[] = [];

        for (const move of this.movementVectors) {
            const newRow = currentPos.row + move.row;
            const newCol = currentPos.col + move.col;

            // Check if the new position is within the board boundaries
            if (ChessBoard.isInsideBoard(newRow, newCol)) {
                // Check if the square is empty or occupied by an opponent's piece
                const targetPiece = board[newRow]?.[newCol];
                if (!targetPiece || targetPiece.color !== this.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        return moves;
    }

}