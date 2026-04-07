import { useMemo, useState } from "react";
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

type PlayerInfo = {
  name: string;
  color: "white" | "black";
  elo?: number;
  status?: string;
  avatarText?: string;
  online?: boolean;
};

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

function getPieceName(piece: string) {
  switch (piece) {
    case "wk":
      return "Vua trắng";
    case "wq":
      return "Hậu trắng";
    case "wr":
      return "Xe trắng";
    case "wb":
      return "Tượng trắng";
    case "wn":
      return "Mã trắng";
    case "wp":
      return "Tốt trắng";
    case "bk":
      return "Vua đen";
    case "bq":
      return "Hậu đen";
    case "br":
      return "Xe đen";
    case "bb":
      return "Tượng đen";
    case "bn":
      return "Mã đen";
    case "bp":
      return "Tốt đen";
    default:
      return "Chưa chọn quân cờ";
  }
}

function ChessBoard() {
  const [board, setBoard] = useState(initialBoard);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [currentTurn, setCurrentTurn] = useState<"white" | "black">("white");
  const [moveCount, setMoveCount] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);

  const [topPlayer] = useState<PlayerInfo>({
    name: "Chưa có đối thủ",
    color: "black",
    status: "Đang chờ ghép trận",
    avatarText: "?",
    online: false,
  });

  const [bottomPlayer] = useState<PlayerInfo>({
    name: "Người chơi",
    color: "white",
    status: "Chưa kết nối tài khoản",
    avatarText: "U",
    online: true,
  });

  const selectedPiece = useMemo(() => {
    if (!selectedCell) return "";
    return board[selectedCell.row][selectedCell.col];
  }, [board, selectedCell]);

  const formatSquare = (row: number, col: number) => {
    return `${String.fromCharCode(97 + col)}${8 - row}`;
  };

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
    const fromSquare = formatSquare(selectedCell.row, selectedCell.col);
    const toSquare = formatSquare(row, col);

    newBoard[row][col] = movingPiece;
    newBoard[selectedCell.row][selectedCell.col] = "";

    setBoard(newBoard);
    setSelectedCell(null);
    setMoveCount((prev) => prev + 1);
    setCurrentTurn((prev) => (prev === "white" ? "black" : "white"));
    setMoves((prev) => [...prev, `${getPieceSymbol(movingPiece)} ${fromSquare} → ${toSquare}`]);
  };

  const resetBoard = () => {
    setBoard(initialBoard);
    setSelectedCell(null);
    setCurrentTurn("white");
    setMoveCount(0);
    setMoves([]);
  };

  const groupedMoves = [];
  for (let i = 0; i < moves.length; i += 2) {
    groupedMoves.push({
      turn: Math.floor(i / 2) + 1,
      white: moves[i] || "",
      black: moves[i + 1] || "",
    });
  }

  return (
    <div className="chess-app">
      <div className="chess-shell">
        <div className="chess-main">
          <div className="player-card player-top">
            <div className="player-left">
              <div className="player-avatar enemy">{topPlayer.avatarText || "?"}</div>
              <div>
                <p className="player-name">{topPlayer.name || "Chưa có đối thủ"}</p>
                <p className="player-meta">
                  {topPlayer.color === "black" ? "Đen" : "Trắng"}
                  {topPlayer.elo ? ` • ELO ${topPlayer.elo}` : ""}
                  {topPlayer.status ? ` • ${topPlayer.status}` : ""}
                </p>
              </div>
            </div>
            <div className={`player-status-dot ${topPlayer.online ? "online" : "offline"}`} />
          </div>

          <div className="board-section">
            <div className="board-frame">
              <div className="board-grid">
                {board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    const isDark = (rowIndex + colIndex) % 2 === 1;
                    const isSelected =
                      selectedCell?.row === rowIndex && selectedCell?.col === colIndex;

                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`square ${isDark ? "dark" : "light"} ${isSelected ? "selected" : ""}`}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                      >
                        <span
                          className={`piece ${
                            cell.startsWith("w")
                              ? "white-piece"
                              : cell.startsWith("b")
                              ? "black-piece"
                              : ""
                          }`}
                        >
                          {getPieceSymbol(cell)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="player-card player-bottom active-turn">
            <div className="player-left">
              <div className="player-avatar self">{bottomPlayer.avatarText || "U"}</div>
              <div>
                <p className="player-name">{bottomPlayer.name || "Người chơi"}</p>
                <p className="player-meta">
                  {bottomPlayer.color === "white" ? "Trắng" : "Đen"}
                  {bottomPlayer.elo ? ` • ELO ${bottomPlayer.elo}` : ""}
                  {bottomPlayer.status ? ` • ${bottomPlayer.status}` : ""}
                </p>
              </div>
            </div>
            <div className="player-status-text">
              {currentTurn === bottomPlayer.color ? "Đến lượt bạn" : "Đang chờ"}
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="panel status-panel">
            <h3>Trạng thái trận đấu</h3>
            <div className="status-list">
              <div className="status-row">
                <span>Lượt hiện tại</span>
                <strong>{currentTurn === "white" ? "Trắng" : "Đen"}</strong>
              </div>
              <div className="status-row">
                <span>Số nước đã đi</span>
                <strong>{moveCount}</strong>
              </div>
              <div className="status-row">
                <span>Quân đang chọn</span>
                <strong>{selectedPiece ? getPieceName(selectedPiece) : "Chưa chọn"}</strong>
              </div>
              <div className="status-row">
                <span>Trạng thái</span>
                <strong>
                  {currentTurn === bottomPlayer.color ? "Đến lượt bạn" : "Đang chờ đối thủ"}
                </strong>
              </div>
            </div>
          </div>

          <div className="panel move-panel">
            <div className="panel-header">
              <h3>Lịch sử nước đi</h3>
              <span>{moves.length} moves</span>
            </div>

            {groupedMoves.length > 0 ? (
              <div className="move-table">
                <div className="move-head">
                  <span>#</span>
                  <span>Trắng</span>
                  <span>Đen</span>
                </div>

                {groupedMoves.map((move) => (
                  <div className="move-row" key={move.turn}>
                    <span>{move.turn}</span>
                    <span>{move.white}</span>
                    <span>{move.black}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel-text">Chưa có nước đi nào.</div>
            )}
          </div>

          <div className="panel action-panel">
            <h3>Thao tác nhanh</h3>
            <div className="action-grid">
              <button className="primary-btn" onClick={resetBoard}>
                Reset bàn cờ
              </button>
              <button className="ghost-btn">Xin hòa</button>
              <button className="ghost-btn">Đầu hàng</button>
              <button className="ghost-btn">Rời phòng</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChessBoard;