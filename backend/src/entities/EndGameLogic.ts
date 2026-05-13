import { Color } from "../types/Color";
import { ChessBoard } from "./ChessBoard";
import { Piece } from "./Piece";

export type GameEndReason = 
    | "checkmate"
    | "stalemate"
    | "insufficient_material"
    | "resignation"
    | "timeout";

export type GameEndResult =
    | { ended: false}
    | { ended: true; reason: GameEndReason; winner: Color | null };

// ---------------
// ENDGAMELOGIC
// ---------------
export class EndGameLogic {
    private readonly board: ChessBoard;

    constructor(board: ChessBoard) {
        this.board = board;
    }

    // -------------PUBLIC API----------------

    /**
     * Gọi sau mỗi lần movePiece() thành công
     * @param currentTurn - màu đang đến lượt
     */
    public checkGameEnd(currentTurn: Color): GameEndResult {
        if (!this.hasAnyLegalMoves(currentTurn)) {
            if (this.isKingInCheck(currentTurn)) {
                const winner: Color = currentTurn === "white" ? "black" : "white";
                return { ended: true, reason: "checkmate", winner };
            }
            return { ended: true, reason: "stalemate", winner: null };
        }

        if (this.isInsufficientMaterial()) {
            return { ended: true, reason: "insufficient_material", winner: null }
        }

        return { ended: false };
    }

    /**
     * Gọi khi player bấm đầu hàng
     */
    public resign(resigningColor: Color): GameEndResult {
        const winner: Color = resigningColor === "white" ? "black" : "white";
        return { ended: true, reason: "resignation", winner };
    }

    /**
     * Gọi khi hết giờ
     */
    public timeout(timeOutColor: Color): GameEndResult {
        const winner: Color = timeOutColor === "white" ? "black" : "white";

        //Nếu bên thắng không đủ quân chiếu hết -> hòa
        if (this.cannotCheckmate(winner)) {
            return { ended: true, reason: "timeout", winner: null };
        }
        return { ended: true, reason: "timeout", winner };
    }

    //-----------PRIVATE HELPERS-----------------

    /**
     * Kiểm tra bên 'color' còn ít nhất 1 nước đi hợp lệ không
     */
    private hasAnyLegalMoves(color: Color): boolean {
        const rawBoard = this.board.getBoard();

        for (let row = 0; row < 8; row++) {
            for (let col =0; col < 8; col ++) {
                const piece = rawBoard[row]?.[col];
                if (!piece || piece.color !== color)
                    continue;
                
                const legalMoves = this.board.getLegalMoves({ row, col });
                if (legalMoves.length > 0)
                    return true;
            }
        }
        return false;

    }


    /**
     * Kiểm tra vua của 'color' có đang bị chiếu hay không
     */
    private isKingInCheck(color: Color): boolean {
        const kingPos = this.board.getKingPosition(color);
        const rawBoard = this.board.getBoard();
        const enemy: Color = color === "white" ? "black" : "white";

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = rawBoard[row]?.[col];
                if (!piece || piece.color !== enemy)
                    continue;

                //Pawn tấn công chéo
                if (piece.type === "pawn") {
                    const dir = enemy === "white" ? -1 : 1;
                    if (
                        row + dir === kingPos.row &&
                        (col - 1 === kingPos.col || col + 1 === kingPos.col)
                    ) {
                        return true;
                    }
                    continue;
                }

                //King tấn công 1 ô xung quanh
                if (piece.type === "king") {
                    if (
                        Math.abs(row - kingPos.row) <= 1 &&
                        Math.abs(col - kingPos.col) <= 1 &&
                        !(row === kingPos.row && col === kingPos.col)
                    ) {
                        return true;
                    }
                    continue
                }

                //Các quân còn lại
                const attacks = piece.getValidMoves({ row, col }, rawBoard);
                if (attacks.some((m) => m.row === kingPos.row && m.col === kingPos.col)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Kiểm tra không đủ quân để chiếu hết (hòa vật chất)
     * Các trường hợp hòa:
     *  K vs K
     *  K vs K + B
     *  K vs K + N
     *  K + B vs K + B
     */
    private isInsufficientMaterial(): boolean {
        const rawBoard = this.board.getBoard();

        const pieces: { 
            piece: Piece;
            row: number;
            col: number 
        }[] = [];

        for (let row = 0; row < 8; row ++) {
            for (let col = 0; col < 8; col ++) {
                const piece = rawBoard[row]?.[col];
                if (piece) 
                    pieces.push({ piece, row, col });
            }
        }

        const white = pieces.filter((p) => p.piece.color === "white");
        const black = pieces.filter((p) => p.piece.color === "black");

        const wTypes = white.map((p) => p.piece.type);
        const bTypes = black.map((p) => p.piece.type);

        // K vs K
        if (wTypes.length === 1 && bTypes.length === 1)
            return true;

        // K vs K+B or K vs K+N
        if (wTypes.length === 1 && bTypes.length === 2) {
            if (bTypes.includes("bishop") || bTypes.includes("knight"))
                return true;
        }
        if (bTypes.length === 1 && wTypes.length === 2) {
            if (wTypes.includes("bishop") || wTypes.includes("knight"))
                return true;
        }

        // K+B vs K+B
        if (wTypes.length === 2 && bTypes.length === 2) {
            const wBishop = white.find((p) => p.piece.type === "bishop");
            const bBishop = black.find((p) => p.piece.type === "bishop");

            if (wBishop && bBishop)
            {
                const wSquareColor = (wBishop.row + wBishop.col) % 2;
                const bSquareColor = (bBishop.row + bBishop.col) % 2;
                if (wSquareColor === bSquareColor)
                    return true;
            }
        }

        return false;
    }

    /**
     * Kiểm tra 'color' có đủ quân để chiếu hết hay không
     * (dùng cho timeout)
     */
    private cannotCheckmate(color: Color): boolean {
        const rawBoard = this.board.getBoard();
        const types: string[] = [];

        for (let row = 0; row < 8; row++) {
            for (let col = 0;  col < 8; col++) {
                const piece = rawBoard[row]?.[col];
                if (piece && piece.color === color)
                    types.push(piece.type);
            }
        }

        if (types.length === 1)
            return true;

        if (types.length === 2) {
            if (types.includes("knight") || types.includes("bishop"))
                return true;
        }

        return false;
    }
}

