//dinh nghia cac quan co duoi dang hang so
export const PIECE_TYPES = Object.freeze({
    PAWN: "pawn",
    ROOK: "rook",
    KNIGHT: "knight",
    BISHOP: "bishop",
    QUEEN: "queen",
    KING: "king",
});

//dinh nghia 2 mau quan co
export const COLORS = Object.freeze({
    WHITE: "white",
    BLACK: "black",
});

//ham tao ra 1 quan co
export function createPiece(type: string, color: string) {
    return {
        type,
        color,
        hasMoved: false,
    };
}

//ham tao ban co rong 8x8
export function createEmptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
}

//ham tao ban co chuan luc bat dau
export function createInitialBoard() {
    const board = createEmptyBoard();
    const backRank = [
        PIECE_TYPES.ROOK,
        PIECE_TYPES.KNIGHT,
        PIECE_TYPES.BISHOP,
        PIECE_TYPES.QUEEN,
        PIECE_TYPES.KING,
        PIECE_TYPES.BISHOP,
        PIECE_TYPES.KNIGHT,
        PIECE_TYPES.ROOK,
    ];

    for (let col = 0; col < 8; col += 1) {
        board[0][col] = createPiece(backRank[col], COLORS.BLACK);
        board[1][col] = createPiece(PIECE_TYPES.PAWN, COLORS.BLACK);
        board[6][col] = createPiece(PIECE_TYPES.PAWN, COLORS.WHITE);
        board[7][col] = createPiece(backRank[col], COLORS.WHITE);
    }
    return board;
}

//ham tao ra ban sao moi
export function cloneBoard(board) {
    return board.map((row) =>
        row.map((piece) => (piece ? { ...piece } : null))
    );
}

//kiem tra toa do co nam trong ban co khong
export function isInsideBoard(row: number, col: number) {
    return row >= 0 && col >= 0 && row < 8 && col < 8;
}
    
//chuyen o co dang chuoi nhu e2 thanh toa do mang
//row = 8 rank
export function squareToCoords(square: string) {
    if (!/^[a-h][1-8]$/i.test(square)) {
        throw new Error(`Invalid square: ${square}`);
    }
    const file = square[0].toLowerCase();
    const rank = Number(square[1]);
    return {
        row: 8 - rank,
        //charCodeAT: lay ma ASCII cua chu cai
        col: file.charCodeAt(0) - 97,
    };
}

// chuyen nguoc toa do mang ve o co dang chuoi
export function coordsToSquare(row, col) {
    if (!isInsideBoard(row, col)) {
        throw new Error(`Invalid coordinates: row =${row}, col=${col}`);
    }
    //chuyen cot ve chu cai
    const file = String.fromCharCode(97 + col);
    //chuyen row ve rank
    const rank = 8 - row;
    return `${file}${rank}`;
}

//lay quan co tu ban co
export function getPiece(board, squareOrRow, maybeCol) {
    if (typeof squareOrRow === "string") {
        const { row, col } = squareToCoords(squareOrRow);
        return board[row][col];
    }
    const row = squareOrRow;
    const col = maybeCol;

    if (!isInsideBoard(row, col)) {
        throw new Error(`Invalid coordinates: row=${row}, col=${col}`);
    }
    return board[row][col];
}

//Dat quan co vao ban co
export function setPiece(board, squareOrRow, maybeCol, maybePiece) {
    //th truyen o kieu e2
    if (typeof squareOrRow === "string") {
        const { row, col } = squareToCoords(squareOrRow);
        board[row][col] = maybeCol;
        return board;
    }
    //th truyen row, cok, piece
    const row = squareOrRow;
    const col = maybeCol;
    if (!isInsideBoard(row, col)) {
        throw new Error(`Invalid coordinates: row=${row}, col=${col}`);
    }
    board[row][col] = maybePiece;
    return board;
}

//Di chuyen quan co tu o nguon sang dich
//ham nay chua ktra di dung luat
export function movePiece(board, fromSquare, toSquare) {
    // doi o nguon va dich sang toa do
    const from = squareToCoords(fromSquare);
    const to = squareToCoords(toSquare);

    // lay quan co tai o nguon
    const piece = board[from.row][from.col];
    // neu o nguon khong co quan thi bao loi
    if (!piece) {
        throw new Error(`No piece found at ${fromSquare}`);
    }

    //Dat quan sang o dich
    board[to.row][to.col] = {
        ...piece,
        hasMoved: true,
    };

    //Xoa quan o nguon
    board[from.row][from.col] = null;
    return board;
}

//Ham doi quan co thanh ky tu ngan de in ra console
//muc dich de debug
export function pieceToDebugChar(piece) {
    if (!piece)
        return ".";
    const charMap = {
        [PIECE_TYPES.PAWN]: "P",
        [PIECE_TYPES.ROOK]: "R",
        [PIECE_TYPES.KNIGHT]: "N",
        [PIECE_TYPES.BISHOP]: "B",
        [PIECE_TYPES.QUEEN]: "Q",
        [PIECE_TYPES.KING]: "K"
    };
    const ch = charMap[piece.type];
    //trang in hoa, den in thuong
    return piece.color === COLORS.WHITE ? ch : ch.toLowerCase();
}

//In toan bo ban co ra dang text de debug
export function printBoard(board) {
    const lines = [];
    for (let row = 0; row < 8; row += 1) {
        const rank = 8 - row;
        const rowText = board[row].map(pieceToDebugChar).join(" ");
        lines.push(`${rank} ${rowText}`);
    }

    lines.push("  a b c d e f g h ");
    return lines.join("\n");
}

