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
    private currentTurn: Color = "white";
    private halfMoveClock = 0;
    private enPassantTarget: Position | null = null;

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

    // Static direction arrays - optimized for isSquareUnderAttack (called millions of times)
    private static readonly KNIGHT_MOVES: readonly Position[] = [
        { row: -2, col: -1 }, { row: -2, col: 1 },
        { row: -1, col: -2 }, { row: -1, col: 2 },
        { row: 1, col: -2 }, { row: 1, col: 2 },
        { row: 2, col: -1 }, { row: 2, col: 1 },
    ];

    private static readonly KING_MOVES: readonly Position[] = [
        { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
        { row: 0, col: -1 }, { row: 0, col: 1 },
        { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 },
    ];

    private static readonly STRAIGHT_DIRECTIONS: readonly Position[] = [
        { row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 },
    ];

    private static readonly DIAGONAL_DIRECTIONS: readonly Position[] = [
        { row: -1, col: -1 }, { row: -1, col: 1 }, { row: 1, col: -1 }, { row: 1, col: 1 },
    ];

    constructor() {
        this.board = this.initializeBoard();
        this.kingPositions = this.findInitialKingPositions();
    }

    public getCurrentTurn(): Color {
        return this.currentTurn;
    }

    private switchTurn(): void {
        this.currentTurn = this.currentTurn === "white" ? "black" : "white";
    }

    private isPlayersTurn(piece: Piece): boolean {
        return piece.color === this.currentTurn;
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
            if (!this.wouldLeaveKingInCheck(from, move, piece.color, undefined)) {
                legalMoves.push(move);
            }
        }

        if (piece.type === "pawn") {
            const enPassantMoves = this.getEnPassantMoves(from, piece.color);
            for (const move of enPassantMoves) {
                if (!this.wouldLeaveKingInCheck(from, move, piece.color, undefined)) {
                    legalMoves.push(move);
                }
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

    public movePiece(from: Position, to: Position, promotionPiece?: "queen" | "rook" | "bishop" | "knight"): boolean {
        const piece = this.getPieceAt(from);
        if (!piece) {
            return false;
        }

        if (!this.isPlayersTurn(piece)) {
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
        this.applyMove(from, to, promotionPiece);
        this.switchTurn();

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

    private applyMove(from: Position, to: Position, promotionPiece?: "queen" | "rook" | "bishop" | "knight"): void {
        const piece = this.getPieceAt(from);
        if (!piece) {
            return;
        }

        const targetPiece = this.getPieceAt(to);
        const isPawnMove = piece.type === "pawn";
        let isCapture = targetPiece !== null;

        const previousEnPassantTarget = this.enPassantTarget
            ? { ...this.enPassantTarget }
            : null;
        this.enPassantTarget = null;

        const isCastling =
            piece.type === "king" &&
            from.row === to.row &&
            Math.abs(to.col - from.col) === 2;

        const isEnPassantCapture =
            piece.type === "pawn" &&
            previousEnPassantTarget !== null &&
            to.row === previousEnPassantTarget.row &&
            to.col === previousEnPassantTarget.col &&
            from.col !== to.col &&
            targetPiece === null;

        if (isEnPassantCapture) {
            if (Math.abs(from.col - to.col) === 1) {
                const capturedPawnRow = piece.color === "white" ? to.row + 1 : to.row - 1;
                this.setPieceAt({ row: capturedPawnRow, col: to.col }, null);
                isCapture = true;
            }
        }

        this.setPieceAt(from, null);
        this.setPieceAt(to, piece);

        if (piece.type === "king") {
            this.kingPositions[piece.color] = { row: to.row, col: to.col };
        }

        if (isCastling) {
            const rookFrom = { row: from.row, col: to.col === 6 ? 7 : 0 };
            const rookTo = { row: from.row, col: to.col === 6 ? 5 : 3 };

            const rook = this.getPieceAt(rookFrom);

            if (rook && rook.type === "rook") {
                this.setPieceAt(rookFrom, null);
                this.setPieceAt(rookTo, rook);
                rook.setMoved();
            }

            // Mark king as moved for castling
            piece.setMoved();
            return; // Early return after castling
        }

        if (piece.type === "pawn" && Math.abs(to.row - from.row) === 2) {
            this.enPassantTarget = {
                row: (from.row + to.row) / 2,
                col: from.col,
            };
        }

        if (isPawnMove || isCapture) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        // Handle pawn promotion with player choice
        if (piece.type === "pawn") {
            const promotionRow = piece.color === "white" ? 0 : 7;
            if (to.row === promotionRow) {
                const promotedPiece = this.createPromotedPiece(piece.color, promotionPiece || "queen");
                promotedPiece.setMoved();
                this.setPieceAt(to, promotedPiece);
                return;
            }
        }

        piece.setMoved();
    }

    /**
     * Create a promoted piece based on the type (queen, rook, bishop, knight)
     * Default: queen (if no choice provided)
     */
    private createPromotedPiece(color: Color, pieceType: "queen" | "rook" | "bishop" | "knight"): Piece {
        switch (pieceType) {
            case "queen":
                return new Queen(color);
            case "rook":
                return new Rook(color);
            case "bishop":
                return new Bishop(color);
            case "knight":
                return new Knight(color);
            default:
                return new Queen(color);
        }
    }

    public promotePawn(position: Position, newPieceType: "queen" | "rook" | "bishop" | "knight"): void {
        const piece = this.getPieceAt(position);
        if (!piece || piece.type !== "pawn") return;

        let promotedPiece: Piece;
        switch (newPieceType) {
            case "queen": promotedPiece = new Queen(piece.color); break;
            case "rook": promotedPiece = new Rook(piece.color); break;
            case "bishop": promotedPiece = new Bishop(piece.color); break;
            case "knight": promotedPiece = new Knight(piece.color); break;
            default: promotedPiece = new Queen(piece.color); break;
        }
        promotedPiece.setMoved();
        this.setPieceAt(position, promotedPiece);
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

    private getEnPassantMoves(from: Position, color: Color): Position[] {
        if (!this.enPassantTarget) {
            return [];
        }

        const piece = this.getPieceAt(from);
        if (!piece || piece.type !== "pawn") {
            return [];
        }

        const direction = color === "white" ? -1 : 1;
        const expectedRow = from.row + direction;

        if (
            this.enPassantTarget.row !== expectedRow ||
            Math.abs(this.enPassantTarget.col - from.col) !== 1
        ) {
            return [];
        }

        const adjacentPawn = this.getPieceAt({
            row: from.row,
            col: this.enPassantTarget.col,
        });

        if (
            adjacentPawn &&
            adjacentPawn.type === "pawn" &&
            adjacentPawn.color !== color
        ) {
            return [{ ...this.enPassantTarget }];
        }

        return [];
    }

    private wouldLeaveKingInCheck(
        from: Position,
        to: Position,
        color: Color,
        promotionPiece?: "queen" | "rook" | "bishop" | "knight"
    ): boolean {
        const snapshot = this.saveSnapshot();
        this.applyMove(from, to, promotionPiece);
        const inCheck = this.isKingInCheck(color);
        this.restoreSnapshot(snapshot);

        return inCheck;
    }

    private isKingInCheck(color: Color): boolean {
        const enemyColor: Color = color === "white" ? "black" : "white";
        return this.isSquareUnderAttack(this.kingPositions[color], enemyColor);
    }

    public isCheck(color: Color): boolean {
        return this.isKingInCheck(color);
    }

    private isSquareUnderAttack(target: Position, byColor: Color): boolean {
        // Pawn attacks (inline, minimal allocation)
        const pawnDirection = byColor === "white" ? -1 : 1;
        const pawnRow = target.row - pawnDirection;
        if (ChessBoard.isInsideBoard(pawnRow, target.col - 1)) {
            const piece = this.getPieceAt({ row: pawnRow, col: target.col - 1 });
            if (piece?.type === "pawn" && piece.color === byColor) return true;
        }
        if (ChessBoard.isInsideBoard(pawnRow, target.col + 1)) {
            const piece = this.getPieceAt({ row: pawnRow, col: target.col + 1 });
            if (piece?.type === "pawn" && piece.color === byColor) return true;
        }

        // Knight attacks (using static array - no allocation)
        for (const move of ChessBoard.KNIGHT_MOVES) {
            const newRow = target.row + move.row;
            const newCol = target.col + move.col;
            if (ChessBoard.isInsideBoard(newRow, newCol)) {
                const piece = this.getPieceAt({ row: newRow, col: newCol });
                if (piece?.type === "knight" && piece.color === byColor) return true;
            }
        }

        // King attacks (using static array - no allocation)
        for (const move of ChessBoard.KING_MOVES) {
            const newRow = target.row + move.row;
            const newCol = target.col + move.col;
            if (ChessBoard.isInsideBoard(newRow, newCol)) {
                const piece = this.getPieceAt({ row: newRow, col: newCol });
                if (piece?.type === "king" && piece.color === byColor) return true;
            }
        }

        // Rook/Queen attacks - straight lines (using static array - no allocation)
        for (const dir of ChessBoard.STRAIGHT_DIRECTIONS) {
            let r = target.row + dir.row;
            let c = target.col + dir.col;

            while (ChessBoard.isInsideBoard(r, c)) {
                const piece = this.getPieceAt({ row: r, col: c });
                if (piece) {
                    if ((piece.type === "rook" || piece.type === "queen") && piece.color === byColor) {
                        return true;
                    }
                    break; // Stop khi gặp quân bất kỳ
                }
                r += dir.row;
                c += dir.col;
            }
        }

        // Bishop/Queen attacks - diagonals (using static array - no allocation)
        for (const dir of ChessBoard.DIAGONAL_DIRECTIONS) {
            let r = target.row + dir.row;
            let c = target.col + dir.col;
            while (ChessBoard.isInsideBoard(r, c)) {
                const piece = this.getPieceAt({ row: r, col: c });
                if (piece) {
                    if ((piece.type === "bishop" || piece.type === "queen") && piece.color === byColor) {
                        return true;
                    }
                    break;
                }
                r += dir.row;
                c += dir.col;
            }
        }

        return false;
    }

    public hasAnyLegalMoves(color: Color): boolean {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row]?.[col];
                if (!piece || piece.color !== color) {
                    continue;
                }

                const moves = this.getLegalMoves({ row, col });
                if (moves.length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    public isCheckmate(color: Color): boolean {
        return this.isKingInCheck(color) && !this.hasAnyLegalMoves(color);
    }

    public isStalemate(color: Color): boolean {
        return !this.isKingInCheck(color) && !this.hasAnyLegalMoves(color);
    }

    public isInsufficientMaterial(): boolean {
        const nonKingPieces: { piece: Piece; position: Position }[] = [];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row]?.[col];
                if (!piece) {
                    continue;
                }

                if (piece.type !== "king") {
                    nonKingPieces.push({
                        piece,
                        position: { row, col },
                    });
                }
            }
        }

        // King vs King
        if (nonKingPieces.length === 0) {
            return true;
        }

        // King + Bishop vs King
        // King + Knight vs King
        if (
            nonKingPieces.length === 1 &&
            (nonKingPieces[0]?.piece.type === "bishop" ||
                nonKingPieces[0]?.piece.type === "knight")
        ) {
            return true;
        }

        // King + Bishop vs King + Bishop 
        if (
            nonKingPieces.length === 2 &&
            nonKingPieces[0]?.piece.type === "bishop" &&
            nonKingPieces[1]?.piece.type === "bishop"
        ) {
            if (nonKingPieces[0].piece.color !== nonKingPieces[1].piece.color) return true;

            const bishop1 = nonKingPieces[0].position;
            const bishop2 = nonKingPieces[1].position;

            const bishop1SquareColor = (bishop1.row + bishop1.col) % 2;
            const bishop2SquareColor = (bishop2.row + bishop2.col) % 2;

            return bishop1SquareColor === bishop2SquareColor;
        }

        return false;
    }

    public isFiftyMoveRule(): boolean {
        return this.halfMoveClock >= 100;
    }

    public getGameStatus(): string {
        if (this.isCheckmate("white"))
            return "black_wins";

        if (this.isCheckmate("black"))
            return "white_wins";

        if (this.isStalemate("white") || this.isStalemate("black"))
            return "stalemate";

        if (this.isInsufficientMaterial())
            return "draw_insufficient_material";

        if (this.isFiftyMoveRule())
            return "draw_fifty_move_rule";

        if (this.isKingInCheck(this.currentTurn))
            return "check";

        return "playing";
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
            currentTurn: this.currentTurn,
            halfMoveClock: this.halfMoveClock,
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
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

        this.currentTurn = snapshot.currentTurn;
        this.halfMoveClock = snapshot.halfMoveClock;
        this.enPassantTarget = snapshot.enPassantTarget
            ? { ...snapshot.enPassantTarget }
            : null;
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
            default:
                throw new Error(`Unknown piece type: ${snapshot.type}`);
        }

        if (snapshot.hasMoved) {
            piece.setMoved();
        }

        return piece;
    }

    public static isInsideBoard(row: number, col: number): boolean {
        return row >= 0 && col >= 0 && row < 8 && col < 8;
    }

    public getNotationFromPosition(position: Position): string {
        const files = "abcdefgh";
        const ranks = "87654321";
        return files.charAt(position.col) + ranks.charAt(position.row);
    }
}
