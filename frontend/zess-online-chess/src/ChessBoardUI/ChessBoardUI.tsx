import { useMemo, useState } from "react";
import "./ChessBoardUI.css";
import GameStatusUI, {
  GameStatusType,
} from "../GameStatusUI/GameStatusUI";
import PlayerInfoUI, { PlayerInfo } from "../PlayerInfoUI/PlayerInfoUI";

//{Import ảnh quân cờ PNG}
import bb from "../Image/PNG_Chess/bb.png";
import bk from "../Image/PNG_Chess/bk.png";
import bn from "../Image/PNG_Chess/bn.png";
import bp from "../Image/PNG_Chess/bp.png";
import bq from "../Image/PNG_Chess/bq.png";
import br from "../Image/PNG_Chess/br.png";

import wb from "../Image/PNG_Chess/wb.png";
import wk from "../Image/PNG_Chess/wk.png";
import wn from "../Image/PNG_Chess/wn.png";
import wp from "../Image/PNG_Chess/wp.png";
import wq from "../Image/PNG_Chess/wq.png";
import wr from "../Image/PNG_Chess/wr.png";

//{Bàn cờ khởi tạo ban đầu}
const INITIAL_BOARD = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
];

//{Mảng cột để đổi sang notation a b c d e f g h}
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

//{Thứ tự hiển thị quân bị ăn cho dễ nhìn}
const CAPTURED_PIECE_ORDER = ["q", "r", "b", "n", "p", "k"];

//{Kiểu dữ liệu cho một nước đi}
type MoveNotation = {
  notation: string;
};

//{Map mã quân cờ sang ảnh PNG}
const PIECE_IMAGE_MAP: Record<string, string> = {
  wk,
  wq,
  wr,
  wb,
  wn,
  wp,
  bk,
  bq,
  br,
  bb,
  bn,
  bp,
};

//{Clone bàn cờ để tránh tham chiếu chung}
function cloneBoard(board: string[][]) {
  return board.map((row) => [...row]);
}

const TOP_PLAYER: PlayerInfo = {
  name: "Đối thủ",
  color: "black",
  status: "Đã kết nối",
  avatarText: "D",
  online: true,
};

const BOTTOM_PLAYER: PlayerInfo = {
  name: "Người chơi",
  color: "white",
  status: "Đã sẵn sàng",
  avatarText: "U",
  online: true,
};

function getPieceImage(piece: string) {
  //{Trả về đường dẫn ảnh tương ứng với mã quân cờ}
  return PIECE_IMAGE_MAP[piece] || "";
}

function getPieceName(piece: string) {
  //{Đổi mã quân cờ sang tên tiếng Việt}
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
      return "Chưa chọn";
  }
}

function formatSquare(row: number, col: number) {
  //{Đổi tọa độ mảng thành ô cờ kiểu a1, b2, c3}
  return `${FILES[col]}${8 - row}`;
}

function getPieceNotationLetter(piece: string) {
  //{Ký hiệu notation quốc tế của quân cờ}
  switch (piece[1]) {
    case "k":
      return "K";
    case "q":
      return "Q";
    case "r":
      return "R";
    case "b":
      return "B";
    case "n":
      return "N";
    case "p":
      return "";
    default:
      return "";
  }
}

function getMoveNotation(
  movingPiece: string,
  fromCol: number,
  toRow: number,
  toCol: number,
  capturedPiece: string
) {
  //{Sinh notation rút gọn gần SAN: e4, exd5, Nc3, Kxa6}
  const destinationSquare = formatSquare(toRow, toCol);
  const isCapture = capturedPiece !== "";
  const pieceType = movingPiece[1];

  //{Nếu là tốt}
  if (pieceType === "p") {
    const fromFile = FILES[fromCol];
    return isCapture ? `${fromFile}x${destinationSquare}` : destinationSquare;
  }

  //{Nếu là các quân khác}
  const pieceLetter = getPieceNotationLetter(movingPiece);
  return `${pieceLetter}${isCapture ? "x" : ""}${destinationSquare}`;
}

function buildPieceCountMap(board: string[][]) {
  //{Đếm số lượng từng loại quân đang có trên bàn}
  const countMap: Record<string, number> = {};

  for (const row of board) {
    for (const piece of row) {
      if (piece === "") continue;
      countMap[piece] = (countMap[piece] || 0) + 1;
    }
  }

  return countMap;
}

function getCapturedPieces(board: string[][]) {
  //{Tính các quân đã bị ăn bằng cách so sánh với bàn cờ ban đầu}
  const initialCountMap = buildPieceCountMap(INITIAL_BOARD);
  const currentCountMap = buildPieceCountMap(board);

  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];

  for (const pieceType of CAPTURED_PIECE_ORDER) {
    const whitePieceCode = `w${pieceType}`;
    const blackPieceCode = `b${pieceType}`;

    const missingWhiteCount =
      (initialCountMap[whitePieceCode] || 0) -
      (currentCountMap[whitePieceCode] || 0);

    const missingBlackCount =
      (initialCountMap[blackPieceCode] || 0) -
      (currentCountMap[blackPieceCode] || 0);

    for (let i = 0; i < missingWhiteCount; i += 1) {
      whiteCaptured.push(whitePieceCode);
    }

    for (let i = 0; i < missingBlackCount; i += 1) {
      blackCaptured.push(blackPieceCode);
    }
  }

  return {
    whiteCaptured,
    blackCaptured,
  };
}

function getRankNumber(row: number) {
  //{Hàng trên cùng là 8, hàng dưới cùng là 1}
  return 8 - row;
}

function ChessBoardUI() {
  //{Lưu lịch sử toàn bộ thế cờ, phần tử đầu là trạng thái ban đầu}
  const [boardHistory, setBoardHistory] = useState<string[][][]>([
    cloneBoard(INITIAL_BOARD),
  ]);

  //{Lưu lịch sử notation các nước đi}
  const [moves, setMoves] = useState<MoveNotation[]>([]);

  //{Ô đang được chọn}
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  //{Đang xem tới nửa nước thứ bao nhiêu}
  const [currentViewIndex, setCurrentViewIndex] = useState(0);

  //{Trạng thái ván cờ hiện tại}
  const [gameStatus, setGameStatus] = useState<GameStatusType>("your-turn");

  //{Bàn cờ mới nhất dùng để chơi tiếp}
  const latestBoard = boardHistory[boardHistory.length - 1];

  //{Bàn cờ đang hiển thị, có thể là đang xem lại lịch sử}
  const displayedBoard = boardHistory[currentViewIndex] || boardHistory[0];

  //{Xác định lượt đi ở vị trí đang xem}
  const displayedTurn: "white" | "black" =
    currentViewIndex % 2 === 0 ? "white" : "black";

  //{Kiểm tra có đang đứng ở vị trí mới nhất không}
  const isViewingLatest = currentViewIndex === boardHistory.length - 1;

  //{Lấy quân cờ đang chọn ở bàn cờ hiện tại}
  const selectedPiece = useMemo(() => {
    if (!selectedCell) return "";
    return displayedBoard[selectedCell.row][selectedCell.col];
  }, [displayedBoard, selectedCell]);

  //{Tính quân cờ đã bị ăn ở vị trí đang xem}
  const capturedPieces = useMemo(() => {
    return getCapturedPieces(displayedBoard);
  }, [displayedBoard]);

  const handleCellClick = (row: number, col: number) => {
    //{Nếu đang xem lại lịch sử thì không cho đi quân mới}
    if (!isViewingLatest) {
      return;
    }

    //{Nếu ván đã kết thúc hoặc mất kết nối thì không cho đi tiếp}
    if (
      gameStatus === "draw" ||
      gameStatus === "checkmate" ||
      gameStatus === "disconnected" ||
      gameStatus === "resigned"
    ) {
      return;
    }

    const clickedPiece = latestBoard[row][col];
    const currentTurnPrefix = displayedTurn === "white" ? "w" : "b";

    //{Nếu chưa chọn ô nào thì chỉ cho chọn quân đúng lượt}
    if (selectedCell === null) {
      if (clickedPiece !== "" && clickedPiece.startsWith(currentTurnPrefix)) {
        setSelectedCell({ row, col });
      }
      return;
    }

    //{Nếu click lại đúng ô đang chọn thì bỏ chọn}
    if (selectedCell.row === row && selectedCell.col === col) {
      setSelectedCell(null);
      return;
    }

    //{Nếu click vào quân cùng màu thì đổi ô đang chọn}
    if (clickedPiece !== "" && clickedPiece.startsWith(currentTurnPrefix)) {
      setSelectedCell({ row, col });
      return;
    }

    //{Tạo bàn cờ mới}
    const newBoard = cloneBoard(latestBoard);

    //{Lấy quân đang di chuyển}
    const movingPiece = newBoard[selectedCell.row][selectedCell.col];

    //{Nếu không có quân thì thoát an toàn}
    if (movingPiece === "") {
      setSelectedCell(null);
      return;
    }

    //{Lấy quân bị ăn nếu có}
    const capturedPiece = newBoard[row][col];

    //{Sinh notation cho nước đi}
    const notation = getMoveNotation(
      movingPiece,
      selectedCell.col,
      row,
      col,
      capturedPiece
    );

    //{Di chuyển quân}
    newBoard[row][col] = movingPiece;
    newBoard[selectedCell.row][selectedCell.col] = "";

    //{Cập nhật lịch sử bàn cờ}
    const nextBoardHistory = [...boardHistory, cloneBoard(newBoard)];
    setBoardHistory(nextBoardHistory);

    //{Cập nhật notation}
    setMoves((prev) => [...prev, { notation }]);

    //{Nhảy tới vị trí mới nhất}
    setCurrentViewIndex(nextBoardHistory.length - 1);

    //{Bỏ chọn}
    setSelectedCell(null);

    //{Đổi trạng thái game theo lượt mới}
    const nextTurn = displayedTurn === "white" ? "black" : "white";
    setGameStatus(
      nextTurn === BOTTOM_PLAYER.color ? "your-turn" : "opponent-turn"
    );
  };

  const goToFirstMove = () => {
    //{Về trạng thái ban đầu}
    setSelectedCell(null);
    setCurrentViewIndex(0);
  };

  const goToPreviousMove = () => {
    //{Lùi 1 nửa nước}
    setSelectedCell(null);
    setCurrentViewIndex((prev) => Math.max(prev - 1, 0));
  };

  const goToNextMove = () => {
    //{Tiến 1 nửa nước}
    setSelectedCell(null);
    setCurrentViewIndex((prev) =>
      Math.min(prev + 1, boardHistory.length - 1)
    );
  };

  const goToLastMove = () => {
    //{Nhảy tới vị trí mới nhất}
    setSelectedCell(null);
    setCurrentViewIndex(boardHistory.length - 1);
  };

  const jumpToMove = (moveIndex: number) => {
    //{Nhảy trực tiếp tới một nửa nước}
    setSelectedCell(null);
    setCurrentViewIndex(moveIndex);
  };

  //{Nhóm notation theo từng lượt trắng/đen}
  const groupedMoves: {
    turn: number;
    white: string;
    whiteMoveIndex: number;
    black: string;
    blackMoveIndex: number;
  }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    groupedMoves.push({
      turn: Math.floor(i / 2) + 1,
      white: moves[i]?.notation || "",
      whiteMoveIndex: i + 1,
      black: moves[i + 1]?.notation || "",
      blackMoveIndex: i + 2,
    });
  }

  //{Nếu đang xem lịch sử thì banner vẫn hiển thị theo lượt ở vị trí đó}
  const displayStatus: GameStatusType = isViewingLatest
    ? gameStatus
    : displayedTurn === BOTTOM_PLAYER.color
    ? "your-turn"
    : "opponent-turn";

  return (
    <div className="chess-app">
      <div className="chess-shell">
        <div className="chess-main">
          <PlayerInfoUI
            player={TOP_PLAYER}
            isActive={displayedTurn === TOP_PLAYER.color}
          />

          <GameStatusUI status={displayStatus} />

          <div className="board-section">
            <div className="board-frame">
              <div className="board-grid">
                {displayedBoard.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    const isDark = (rowIndex + colIndex) % 2 === 1;
                    const isSelected =
                      selectedCell?.row === rowIndex &&
                      selectedCell?.col === colIndex;

                    return (
                      <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`square ${isDark ? "dark" : "light"} ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      {/*{Hiện số hàng nhỏ bên góc trái của mỗi hàng}*/
                      colIndex === 0 && (
                        <span className="rank-label">
                          {getRankNumber(rowIndex)}
                        </span>
                      )}

                      {/*{Hiện chữ cột a-b-c-d-e-f-g-h ở hàng cuối cùng}*/
                      rowIndex === 7 && (
                        <span className="file-label">
                          {FILES[colIndex]}
                        </span>
                      )}

                      {/*{Hiện quân cờ bằng PNG}*/}
                      {cell !== "" && (
                        <img
                          src={getPieceImage(cell)}
                          alt={getPieceName(cell)}
                          className="piece-image"
                          draggable={false}
                        />
                      )}
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <PlayerInfoUI
            player={BOTTOM_PLAYER}
            isActive={displayedTurn === BOTTOM_PLAYER.color}
          />
        </div>

        <div className="sidebar">
          <div className="panel">
            <h3>Thông tin ván đấu</h3>

            <div className="status-list">
              <div className="status-row">
                <span>Lượt hiện tại</span>
                <strong>{displayedTurn === "white" ? "Trắng" : "Đen"}</strong>
              </div>

              <div className="status-row">
                <span>Quân đang chọn</span>
                <strong>
                  {selectedPiece ? getPieceName(selectedPiece) : "Chưa chọn"}
                </strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Quân đã bị ăn</h3>

            <div className="captured-section">
              <div className="captured-row">
                <span className="captured-label">Quân trắng</span>
                <div className="captured-list">
                  {capturedPieces.whiteCaptured.length > 0 ? (
                    capturedPieces.whiteCaptured.map((piece, index) => (
                      <img
                        key={`${piece}-${index}`}
                        src={getPieceImage(piece)}
                        alt={getPieceName(piece)}
                        className="captured-piece-image"
                        draggable={false}
                      />
                    ))
                  ) : (
                    <span className="captured-empty">Chưa có</span>
                  )}
                </div>
              </div>

              <div className="captured-row">
                <span className="captured-label">Quân đen</span>
                <div className="captured-list">
                  {capturedPieces.blackCaptured.length > 0 ? (
                    capturedPieces.blackCaptured.map((piece, index) => (
                      <img
                        key={`${piece}-${index}`}
                        src={getPieceImage(piece)}
                        alt={getPieceName(piece)}
                        className="captured-piece-image"
                        draggable={false}
                      />
                    ))
                  ) : (
                    <span className="captured-empty">Chưa có</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Lịch sử nước đi</h3>
              <span>{groupedMoves.length} lượt</span>
            </div>

            {groupedMoves.length > 0 ? (
              <>
                <div className="move-table">
                  <div className="move-head">
                    <span>#</span>
                    <span>Trắng</span>
                    <span>Đen</span>
                  </div>

                  {groupedMoves.map((move) => (
                    <div className="move-row" key={move.turn}>
                      <span>{move.turn}.</span>

                      <span>
                        {move.white ? (
                          <button
                            className={`move-notation-btn ${
                              currentViewIndex === move.whiteMoveIndex
                                ? "active"
                                : ""
                            }`}
                            onClick={() => jumpToMove(move.whiteMoveIndex)}
                          >
                            {move.white}
                          </button>
                        ) : (
                          "…"
                        )}
                      </span>

                      <span>
                        {move.black ? (
                          <button
                            className={`move-notation-btn ${
                              currentViewIndex === move.blackMoveIndex
                                ? "active"
                                : ""
                            }`}
                            onClick={() => jumpToMove(move.blackMoveIndex)}
                          >
                            {move.black}
                          </button>
                        ) : (
                          "…"
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="replay-controls">
                  <button
                    className="replay-btn"
                    onClick={goToFirstMove}
                    disabled={currentViewIndex === 0}
                    title="Về đầu"
                  >
                    ⏮
                  </button>

                  <button
                    className="replay-btn"
                    onClick={goToPreviousMove}
                    disabled={currentViewIndex === 0}
                    title="Lùi 1 nước"
                  >
                    ‹
                  </button>

                  <button
                    className="replay-btn"
                    onClick={goToNextMove}
                    disabled={currentViewIndex === boardHistory.length - 1}
                    title="Tiến 1 nước"
                  >
                    ›
                  </button>

                  <button
                    className="replay-btn"
                    onClick={goToLastMove}
                    disabled={currentViewIndex === boardHistory.length - 1}
                    title="Tới cuối"
                  >
                    ⏭
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-panel-text">
                Chưa có nước đi nào. Notation sẽ hiện kiểu e4, exd5, Nc3, Kxa6...
              </div>
            )}
          </div>

          <div className="panel">
            <h3>Thao tác nhanh</h3>

            <div className="action-grid">
              <button
                className="ghost-btn"
                onClick={() => setGameStatus("draw")}
              >
                Xin hòa
              </button>

              <button
                className="ghost-btn"
                onClick={() => setGameStatus("resigned")}
              >
                Đầu hàng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChessBoardUI;