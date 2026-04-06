import { Piece } from "../Piece";
import { Color } from "./Color";
import { Position } from "./Position";

export type PieceSnapshot = {
    type: Piece["type"];
    color: Color;
    hasMoved: boolean;
};

export type BoardSnapshot = {
    board: (PieceSnapshot | null)[][];
    kingPositions: { white: Position; black: Position };
    currentTurn: Color;
};
