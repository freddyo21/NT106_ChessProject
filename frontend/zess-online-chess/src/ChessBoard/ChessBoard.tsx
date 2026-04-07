import { useState } from "react";
import "./ChessBoard.css";

const initialBoard = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
];

function getPieceSymbol(piece: string) {
  switch (piece) {
    case "wk":
      return "♔";
    case "wq":
      return "♕";
    case "wr":
      return "♖";
    case "wb":
      return "♗";
    case "wn":
      return "♘";
    case "wp":
      return "♙";
    case "bk":
      return "♚";
    case "bq":
      return "♛";
    case "br":
      return "♜";
    case "bb":
      return "♝";
    case "bn":
      return "♞";
    case "bp":
      return "♟";
    default:
      return "";
  }
}

function ChessBoard() {
  const [board, setBoard] = useState(initialBoard);
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const handleCellClick = (row: number, col: number) => {
    const clickedPiece = board[row][col];

    if (selectedCell === null) {
      if (clickedPiece !== "") {
        setSelectedCell({ row, col });
      }
      return;
    }

    if (selectedCell.row === row && selectedCell.col === col) {
      setSelectedCell(null);
      return;
    }

    const newBoard = board.map((r) => [...r]);
    const movingPiece = newBoard[selectedCell.row][selectedCell.col];

    newBoard[row][col] = movingPiece;
    newBoard[selectedCell.row][selectedCell.col] = "";

    setBoard(newBoard);
    setSelectedCell(null);
  };

  return (
    <div className="board">
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isDark = (rowIndex + colIndex) % 2 === 1;
          const isSelected =
            selectedCell?.row === rowIndex && selectedCell?.col === colIndex;

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`square ${isDark ? "dark" : "light"} ${
                isSelected ? "selected" : ""
              }`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              {getPieceSymbol(cell)}
            </div>
          );
        })
      )}
    </div>
  );
}

export default ChessBoard;