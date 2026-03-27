import { Color } from "../types/Color";
import { Position } from "../types/Position";
import { ChessBoard } from "./ChessBoard";
import { Piece } from "./Piece";

export class King extends Piece {
    readonly type = "king";

    readonly movementVectors = [
        { row: 1, col: 0 },     // up
        { row: -1, col: 0 },    // down
        { row: 0, col: -1 },    // left
        { row: 0, col: 1 },     // right
        { row: 1, col: -1 },    // up-left
        { row: 1, col: 1 },     // up-right
        { row: -1, col: -1 },   // down-left
        { row: -1, col: 1 },    // down-right
    ];

    constructor(color: Color) {
        super(color);
    }

    getValidMoves(currentPos: Position, board: (Piece | null)[][]): Position[] {
        const moves: Position[] = [];

        // Implementation for valid moves for King
        for (const dir of this.movementVectors) {
            const newRow = currentPos.row + dir.row;
            const newCol = currentPos.col + dir.col;

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