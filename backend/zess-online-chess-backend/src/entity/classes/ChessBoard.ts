import { Color } from "../types/Color";
import { Position } from "../types/Position";
import { King } from "./King";
import { Piece } from "./Piece";
import { Pawn } from "./Pawn";
import { Rook } from "./Rook";
import { Knight } from "./Knight";
import { Bishop } from "./Bishop";
import { Queen } from "./Queen";
import { BoardSnapshot, PieceSnapshot } from "../types/Snapshots";

export class ChessBoard {
    private board: (Piece | null)[][];
    private history: BoardSnapshot[] = [];

    private kingPositions: { white: Position; black: Position };

    private readonly xCoord = {
        a: 0,
        b: 1,
        c: 2,
        d: 3,
        e: 4,
        f: 5,
        g: 6,
        h: 7,
    } as const;

    constructor() {
        this.board = this.initializeBoard();
        this.kingPositions = this.findInitialKingPositions();
    }

    private findInitialKingPositions(): { white: Position; black: Position } {
        let white: Position | null = null;
        let black: Position | null = null;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row]?.[col];
                if (!piece || piece.type !== "king") {
                    continue;
                }

                if (piece.color === "white") {
                    white = { row, col };
                } else {
                    black = { row, col };
                }
            }
        }

        if (!white || !black) {
            throw new Error("Missing king on initial board");
        }

        return { white, black };
    }

    private initializeEmptyBoard(): (Piece | null)[][] {
        const board: (Piece | null)[][] = [];
        for (let i = 0; i < 8; i++) {
            board[i] = Array(8).fill(null);
        }
        return board;
    }

    private initializeBoard(): (Piece | null)[][] {
        const board = this.initializeEmptyBoard();

        if (board.length !== 8 || board.some((r) => r.length !== 8)) {
            throw new Error("Board initialization failed");
        }

        const row0 = board[0];
        const row1 = board[1];
        const row6 = board[6];
        const row7 = board[7];

        if (!row0 || !row1 || !row6 || !row7) {
            throw new Error("Board row missing");
        }

        for (let i = 0; i < 8; i++) {
            row1[i] = new Pawn("black");
            row6[i] = new Pawn("white");
        }

        row0[this.xCoord.a] = new Rook("black");
        row0[this.xCoord.h] = new Rook("black");
        row7[this.xCoord.a] = new Rook("white");
        row7[this.xCoord.h] = new Rook("white");

        row0[this.xCoord.b] = new Knight("black");
        row0[this.xCoord.g] = new Knight("black");
        row7[this.xCoord.b] = new Knight("white");
        row7[this.xCoord.g] = new Knight("white");

        row0[this.xCoord.c] = new Bishop("black");
        row0[this.xCoord.f] = new Bishop("black");
        row7[this.xCoord.c] = new Bishop("white");
        row7[this.xCoord.f] = new Bishop("white");

        row0[this.xCoord.d] = new Queen("black");
        row7[this.xCoord.d] = new Queen("white");

        row0[this.xCoord.e] = new King("black");
        row7[this.xCoord.e] = new King("white");

        return board;
    }


    public getPieceAt(position: Position): Piece | null {
        return this.board[position.row]?.[position.col] ?? null;
    }

    public setPieceAt(position: Position, piece: Piece | null): void {
        const row = this.board[position.row];
        if (!row) return;

        row[position.col] = piece;
    }

    public getBoard(): (Piece | null)[][] {
        return this.board;
    }

    public getKingPosition(color: Color): Position {
        return { ...this.kingPositions[color] };
    }

    public getLegalMoves(from: Position): Position[] {
        const piece = this.getPieceAt(from);
        if (!piece) {
            return [];
        }

        const pseudoLegalMoves = piece.getValidMoves(from, this.board);
        const legalMoves: Position[] = [];

        for (const move of pseudoLegalMoves) {
            if (!this.wouldLeaveKingInCheck(from, move, piece.color)) {
                legalMoves.push(move);
            }
        }

        if (piece.type === "king") {
            const castlingMoves = this.getCastlingMoves(from, piece.color);
            for (const move of castlingMoves) {
                legalMoves.push(move);
            }
        }

        return legalMoves;
    }

    public movePiece(from: Position, to: Position): boolean {
        const piece = this.getPieceAt(from);
        if (!piece) {
            return false;
        }

        const legalMoves = this.getLegalMoves(from);
        const isLegal = legalMoves.some(
            (move) => move.row === to.row && move.col === to.col
        );

        if (!isLegal) {
            return false;
        }

        this.history.push(this.saveSnapshot());
        this.applyMove(from, to);

        return true;
    }

    public undoMove(): boolean {
        const snapshot = this.history.pop();
        if (!snapshot) {
            return false;
        }

        this.restoreSnapshot(snapshot);
        return true;
    }

    private applyMove(from: Position, to: Position): void {
        const piece = this.getPieceAt(from);
        if (!piece) {
            return;
        }

        const isCastling =
            piece.type === "king" &&
            from.row === to.row &&
            Math.abs(to.col - from.col) === 2;

        this.setPieceAt(from, null);
        this.setPieceAt(to, piece);

        if (piece.type === "king") {
            this.kingPositions[piece.color] = { row: to.row, col: to.col };
        }

        if (isCastling) {
            if (to.col === 6) {
                const rookFrom = { row: from.row, col: 7 };
                const rookTo = { row: from.row, col: 5 };
                const rook = this.getPieceAt(rookFrom);

                if (rook && rook.type === "rook") {
                    this.setPieceAt(rookFrom, null);
                    this.setPieceAt(rookTo, rook);
                    rook.setMoved();
                }
            } else if (to.col === 2) {
                const rookFrom = { row: from.row, col: 0 };
                const rookTo = { row: from.row, col: 3 };
                const rook = this.getPieceAt(rookFrom);

                if (rook && rook.type === "rook") {
                    this.setPieceAt(rookFrom, null);
                    this.setPieceAt(rookTo, rook);
                    rook.setMoved();
                }
            }
        }

        piece.setMoved();
    }

    private getCastlingMoves(from: Position, color: Color): Position[] {
        const king = this.getPieceAt(from);
        if (!king || king.type !== "king" || king.hasMoved) {
            return [];
        }

        const homeRow = color === "white" ? 7 : 0;
        if (from.row !== homeRow || from.col !== 4) {
            return [];
        }

        const enemyColor: Color = color === "white" ? "black" : "white";

        if (this.isSquareUnderAttack(from, enemyColor)) {
            return [];
        }

        const castlingMoves: Position[] = [];

        const kingsideRook = this.getPieceAt({ row: homeRow, col: 7 });
        const kingsidePathClear =
            this.getPieceAt({ row: homeRow, col: 5 }) === null &&
            this.getPieceAt({ row: homeRow, col: 6 }) === null;

        const kingsideSafe =
            !this.isSquareUnderAttack({ row: homeRow, col: 5 }, enemyColor) &&
            !this.isSquareUnderAttack({ row: homeRow, col: 6 }, enemyColor);

        if (
            kingsideRook &&
            kingsideRook.type === "rook" &&
            kingsideRook.color === color &&
            !kingsideRook.hasMoved &&
            kingsidePathClear &&
            kingsideSafe
        ) {
            castlingMoves.push({ row: homeRow, col: 6 });
        }

        const queensideRook = this.getPieceAt({ row: homeRow, col: 0 });
        const queensidePathClear =
            this.getPieceAt({ row: homeRow, col: 1 }) === null &&
            this.getPieceAt({ row: homeRow, col: 2 }) === null &&
            this.getPieceAt({ row: homeRow, col: 3 }) === null;

        const queensideSafe =
            !this.isSquareUnderAttack({ row: homeRow, col: 3 }, enemyColor) &&
            !this.isSquareUnderAttack({ row: homeRow, col: 2 }, enemyColor);

        if (
            queensideRook &&
            queensideRook.type === "rook" &&
            queensideRook.color === color &&
            !queensideRook.hasMoved &&
            queensidePathClear &&
            queensideSafe
        ) {
            castlingMoves.push({ row: homeRow, col: 2 });
        }

        return castlingMoves;
    }

    private wouldLeaveKingInCheck(
        from: Position,
        to: Position,
        color: Color
    ): boolean {
        const snapshot = this.saveSnapshot();
        this.applyMove(from, to);
        const inCheck = this.isKingInCheck(color);
        this.restoreSnapshot(snapshot);

        return inCheck;
    }

    private isKingInCheck(color: Color): boolean {
        const enemyColor: Color = color === "white" ? "black" : "white";
        return this.isSquareUnderAttack(this.kingPositions[color], enemyColor);
    }

    private isSquareUnderAttack(target: Position, byColor: Color): boolean {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row]?.[col];
                if (!piece || piece.color !== byColor) {
                    continue;
                }

                if (piece.type === "pawn") {
                    const direction = byColor === "white" ? -1 : 1;
                    const attackLeft = { row: row + direction, col: col - 1 };
                    const attackRight = { row: row + direction, col: col + 1 };

                    if (
                        (ChessBoard.isInsideBoard(attackLeft.row, attackLeft.col) &&
                            attackLeft.row === target.row &&
                            attackLeft.col === target.col) ||
                        (ChessBoard.isInsideBoard(attackRight.row, attackRight.col) &&
                            attackRight.row === target.row &&
                            attackRight.col === target.col)
                    ) {
                        return true;
                    }

                    continue;
                }

                if (piece.type === "king") {
                    for (const vector of piece.movementVectors) {
                        const attackRow = row + vector.row;
                        const attackCol = col + vector.col;

                        if (
                            ChessBoard.isInsideBoard(attackRow, attackCol) &&
                            attackRow === target.row &&
                            attackCol === target.col
                        ) {
                            return true;
                        }
                    }

                    continue;
                }

                const attacks = piece.getValidMoves({ row, col }, this.board);
                const isAttackingTarget = attacks.some(
                    (move) => move.row === target.row && move.col === target.col
                );

                if (isAttackingTarget) {
                    return true;
                }
            }
        }

        return false;
    }


    private saveSnapshot(): BoardSnapshot {
        return {
            board: this.board.map((row) =>
                row.map((piece) =>
                    piece
                        ? {
                            type: piece.type,
                            color: piece.color,
                            hasMoved: piece.hasMoved,
                        }
                        : null
                )
            ),
            kingPositions: {
                white: { ...this.kingPositions.white },
                black: { ...this.kingPositions.black },
            },
        };
    }

    private restoreSnapshot(snapshot: BoardSnapshot): void {
        this.board = snapshot.board.map((row) =>
            row.map((pieceSnapshot) =>
                pieceSnapshot ? this.createPieceFromSnapshot(pieceSnapshot) : null
            )
        );

        this.kingPositions = {
            white: { ...snapshot.kingPositions.white },
            black: { ...snapshot.kingPositions.black },
        };
    }

    private createPieceFromSnapshot(snapshot: PieceSnapshot): Piece {
        let piece: Piece;

        switch (snapshot.type) {
            case "pawn":
                piece = new Pawn(snapshot.color);
                break;
            case "rook":
                piece = new Rook(snapshot.color);
                break;
            case "knight":
                piece = new Knight(snapshot.color);
                break;
            case "bishop":
                piece = new Bishop(snapshot.color);
                break;
            case "queen":
                piece = new Queen(snapshot.color);
                break;
            case "king":
                piece = new King(snapshot.color);
                break;
        }

        if (snapshot.hasMoved) {
            piece.setMoved();
        }

        return piece;
    }

    public static isInsideBoard(row: number, col: number): boolean {
        return row >= 0 && col >= 0 && row < 8 && col < 8;
    }
}
