import { Color } from "../types/Color";
import { Position } from "../types/Position";

export abstract class Piece {
    abstract readonly type: "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";
    public readonly color: Color;
    protected _hasMoved: boolean = false;

    // Basic move directions for pieces like Rook, Bishop, Queen. Knight will override this with specific patterns.
    // King can also use these but will limit to one step in getValidMoves.
    // For pieces like Knight that have specific move patterns, this can be defined in the subclass
    abstract readonly movementVectors: ReadonlyArray<Position>; 
    constructor(color: Color) {
        this.color = color;
    }

    public get hasMoved(): boolean {
        return this._hasMoved;
    }

    public setMoved(): void {
        this._hasMoved = true;
    }

    // Each piece will implement its own logic to determine valid moves based on its movement rules and the current board state.
    // The moves which lead to check or checkmate will be filtered out in the game logic, not here.
    abstract getValidMoves(currentPos: Position, board: (Piece | null)[][]): Position[];
}