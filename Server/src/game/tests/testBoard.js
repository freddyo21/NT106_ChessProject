const {
    createInitialBoard,
    printBoard,
    squareToCoords,
    coordsToSquare,
    getPiece,
    movePiece,
} = require("../models/chessBoard");

//tao ban co luc bat dau tran
const board = createInitialBoard() ;
console.log("=== Initial Board ===") ;

//In ban co ban dau ra man hinh
console.log(printBoard(board));

console.log("\n=== Convert square ===");

console.log("e2 ->", squareToCoords("e2"));

console.log("(6, 4) ->", coordsToSquare(6, 4));

console.log("\n===Piece at e2 ===");

console.log(getPiece(board, "e2"));
console.log("\n=== Move e2 -> e4 ===");

movePiece(board, "e2", "e4");
console.log(printBoard(board));
