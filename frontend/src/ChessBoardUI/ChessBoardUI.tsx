import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_ELO, ERoles } from "@zess-online-chess/shared";
import "./ChessBoardUI.css";
import GameStatusUI, { GameStatusType } from "../GameStatusUI/GameStatusUI";
import ChatUI, { type ChatMessage } from "../ChatUI/ChatUI";
import ConnectionStatusUI from "../ConnectionStatusUI/ConnectionStatusUI";
import {
  getAppSocket,
  getSocketToken,
  type RoomMessagePayload,
  type SocketBoard,
  type SocketGameStatePayload,
  type DrawDeclinedPayload,
  type DrawOfferPayload,
  type TimerSyncPayload,
} from "../services/socketClient";
import { getCurrentUser, getUserDisplayName, type AuthSessionUser } from "../services/authSession";

/* ── Chess piece images ─────────────────────── */

import bb from "/src/Image/PNG_Chess/bb.png";
import bk from "/src/Image/PNG_Chess/bk.png";
import bn from "/src/Image/PNG_Chess/bn.png";
import bp from "/src/Image/PNG_Chess/bp.png";
import bq from "/src/Image/PNG_Chess/bq.png";
import br from "/src/Image/PNG_Chess/br.png";
import wb from "/src/Image/PNG_Chess/wb.png";
import wk from "/src/Image/PNG_Chess/wk.png";
import wn from "/src/Image/PNG_Chess/wn.png";
import wp from "/src/Image/PNG_Chess/wp.png";
import wq from "/src/Image/PNG_Chess/wq.png";
import wr from "/src/Image/PNG_Chess/wr.png";

/* ── Types ──────────────────────────────────── */
type PlayerColor = "white" | "black";
type SidebarTab  = "moves" | "chat" | "info";
type PromotionPiece = "q" | "r" | "b" | "n";

type BoardRouteState = {
  roomId?: string;
  gameId?: string;
  roomName?: string;
  roomCode?: string;
  timeControl?: number;
  bonusSeconds?: number;
  playerColor?: PlayerColor;
  opponentName?: string;
  playerElo?: number;
  opponentElo?: number;
};

type MoveNotation = { notation: string };
type CastlingRights = {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
};
type PendingPromotion = {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
};
type GameResultNotice = {
  title: string;
  message: string;
} | null;
type BoardViewCell = {
  key: string;
  visualRow: number;
  visualCol: number;
  row: number;
  col: number;
  cell: string;
};

/* ── Constants ───────────────────────────────── */
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const CAPTURED_ORDER = ["q", "r", "b", "n", "p", "k"];
const PROMOTION_OPTIONS: { type: PromotionPiece; label: string }[] = [
  { type: "q", label: "Hậu" },
  { type: "r", label: "Xe" },
  { type: "b", label: "Tượng" },
  { type: "n", label: "Mã" },
];

const SOCKET_PROMOTION_MAP: Record<PromotionPiece, "queen" | "rook" | "bishop" | "knight"> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

const UI_PROMOTION_MAP: Record<"queen" | "rook" | "bishop" | "knight", PromotionPiece> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};

const SOCKET_PIECE_MAP: Record<string, string> = {
  "white:king": "wk",
  "white:queen": "wq",
  "white:rook": "wr",
  "white:bishop": "wb",
  "white:knight": "wn",
  "white:pawn": "wp",
  "black:king": "bk",
  "black:queen": "bq",
  "black:rook": "br",
  "black:bishop": "bb",
  "black:knight": "bn",
  "black:pawn": "bp",
};

const INITIAL_BOARD: string[][] = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
];

const INITIAL_CASTLING_RIGHTS: CastlingRights = {
  wK: true,
  wQ: true,
  bK: true,
  bQ: true,
};

const PIECE_IMAGE_MAP: Record<string, string> = {
  wk, wq, wr, wb, wn, wp,
  bk, bq, br, bb, bn, bp,
};

const INITIAL_CHAT: ChatMessage[] = [
  {
    id: "sys-01",
    sender: "System",
    text: "Trận đấu bắt đầu. Chúc bạn may mắn!",
    timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    isOwn: false,
  },
];
const RESULT_AUTO_LEAVE_SECONDS = 10;

/* ── Helpers ─────────────────────────────────── */
function getAuthenticatedUser(): AuthSessionUser {
  // Board identity comes from the real Auth session so chat, Elo, and socket auth stay aligned.
  return getCurrentUser() ?? {
    id: "current-user",
    email: "",
    name: "Người chơi",
    username: "player",
    elo: DEFAULT_ELO,
    role: ERoles.GUEST,
    status: "active",
    isVerified: false,
  };
}

function cloneBoard(b: string[][]): string[][] { return b.map(r => [...r]); }
function areBoardsEqual(a: string[][], b: string[][]): boolean {
  return a.length === b.length && a.every((row, rowIndex) =>
    row.length === (b[rowIndex]?.length ?? -1) &&
    row.every((cell, colIndex) => cell === b[rowIndex]?.[colIndex])
  );
}
function getPieceImage(piece: string): string { return PIECE_IMAGE_MAP[piece] || ""; }

function mapSocketBoardToUiBoard(board: SocketBoard): string[][] {
  return board.map((row) =>
    row.map((piece) => {
      if (!piece) {
        return "";
      }

      return SOCKET_PIECE_MAP[`${piece.color}:${piece.type}`] || "";
    })
  );
}

function getPieceName(piece: string): string {
  const names: Record<string, string> = {
    wk:"Vua trắng", wq:"Hậu trắng", wr:"Xe trắng", wb:"Tượng trắng", wn:"Mã trắng", wp:"Tốt trắng",
    bk:"Vua đen",  bq:"Hậu đen",  br:"Xe đen",  bb:"Tượng đen",  bn:"Mã đen",  bp:"Tốt đen",
  };
  return names[piece] || "";
}

function formatSquare(row: number, col: number): string { return `${FILES[col]}${8 - row}`; }
function getRankNumber(row: number): number { return 8 - row; }
function getColorPrefix(color: PlayerColor): "w" | "b" { return color === "white" ? "w" : "b"; }
function getTurnStatus(turn: PlayerColor, playerColor: PlayerColor): GameStatusType {
  return turn === playerColor ? "your-turn" : "opponent-turn";
}
function getResultMessage(payload: SocketGameStatePayload, playerColor: PlayerColor): string {
  if (payload.reason === "draw_agreement" || payload.eloUpdate?.result === "draw" || payload.gameStatus?.startsWith("draw_") || payload.gameStatus === "stalemate") {
    return "Ván đấu kết thúc: Hòa.";
  }

  const winner = payload.eloUpdate?.result ??
    (payload.gameStatus === "white_wins" ? "white" : payload.gameStatus === "black_wins" ? "black" : null);

  if (!winner) {
    return "Ván đấu đã kết thúc.";
  }

  if (payload.reason === "opponent_left") {
    return winner === playerColor ? "Bạn thắng: đối thủ đã rời phòng." : "Bạn thua: bạn đã rời phòng.";
  }

  if (payload.reason === "resign") {
    return winner === playerColor ? "Bạn thắng: đối thủ đã đầu hàng." : "Bạn thua: bạn đã đầu hàng.";
  }

  return winner === playerColor ? "Bạn thắng ván này." : "Bạn thua ván này.";
}
function getResultTitle(payload: SocketGameStatePayload, playerColor: PlayerColor): string {
  if (payload.reason === "draw_agreement" || payload.eloUpdate?.result === "draw" || payload.gameStatus?.startsWith("draw_") || payload.gameStatus === "stalemate") {
    return "Hòa";
  }

  const winner = payload.eloUpdate?.result ??
    (payload.gameStatus === "white_wins" ? "white" : payload.gameStatus === "black_wins" ? "black" : null);

  if (!winner) {
    return "Ván đấu kết thúc";
  }

  return winner === playerColor ? "Bạn thắng" : "Bạn thua";
}

function getWinnerFromPayload(payload: SocketGameStatePayload): PlayerColor | null {
  return payload.eloUpdate?.result === "white" || payload.eloUpdate?.result === "black"
    ? payload.eloUpdate.result
    : payload.gameStatus === "white_wins"
      ? "white"
      : payload.gameStatus === "black_wins"
        ? "black"
        : null;
}

function getLogicalPosition(visualRow: number, visualCol: number, bottomColor: PlayerColor) {
  // Chuyển ô người dùng bấm trên UI về lại row/col thật của bàn cờ.
  if (bottomColor === "black") {
    return { row: 7 - visualRow, col: 7 - visualCol };
  }

  return { row: visualRow, col: visualCol };
}

function getBoardViewCells(board: string[][], bottomColor: PlayerColor): BoardViewCell[] {
  // Sinh danh sách ô theo thứ tự render để quân của người chơi hiện ở phía dưới.
  const cells: BoardViewCell[] = [];

  for (let visualRow = 0; visualRow < 8; visualRow += 1) {
    for (let visualCol = 0; visualCol < 8; visualCol += 1) {
      const { row, col } = getLogicalPosition(visualRow, visualCol, bottomColor);

      cells.push({
        key: `${visualRow}-${visualCol}`,
        visualRow,
        visualCol,
        row,
        col,
        cell: board[row]?.[col] ?? "",
      });
    }
  }

  return cells;
}

function getMoveNotation(
  piece: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  captured: string,
  promotionPiece?: PromotionPiece
): string {
  if (isCastlingMove(piece, fromRow, fromCol, toRow, toCol)) {
    return toCol === 6 ? "O-O" : "O-O-O";
  }

  const dest = formatSquare(toRow, toCol);
  const isCapture = captured !== "";
  const type = piece[1];
  const letters: Record<string, string> = { k:"K", q:"Q", r:"R", b:"B", n:"N" };
  const promotionSuffix = promotionPiece ? `=${letters[promotionPiece]}` : "";
  if (type === "p") return `${isCapture ? `${FILES[fromCol]}x` : ""}${dest}${promotionSuffix}`;
  return `${letters[type] || ""}${isCapture ? "x" : ""}${dest}`;
}

function appendCheckSuffix(
  notation: string,
  boardAfterMove: string[][],
  nextTurn: PlayerColor,
  rights: CastlingRights
) {
  const nextTurnPrefix = nextTurn === "white" ? "w" : "b";

  if (!isKingInCheck(boardAfterMove, nextTurnPrefix)) {
    return notation;
  }

  return `${notation}${hasAnyLegalMove(boardAfterMove, nextTurnPrefix, rights) ? "+" : "#"}`;
}

function isPawnPromotionMove(piece: string, toRow: number) {
  if (piece[1] !== "p") {
    return false;
  }

  return (piece[0] === "w" && toRow === 0) || (piece[0] === "b" && toRow === 7);
}

/* ── Valid moves engine ───────────────────────── */
function isCastlingMove(piece: string, fromRow: number, fromCol: number, toRow: number, toCol: number) {
  return piece[1] === "k" && fromRow === toRow && fromCol === 4 && Math.abs(toCol - fromCol) === 2;
}

function findKing(board: string[][], color: "w" | "b"): [number, number] | null {
  const king = `${color}k`;

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (board[row][col] === king) {
        return [row, col];
      }
    }
  }

  return null;
}

function isSquareAttacked(board: string[][], row: number, col: number, byColor: "w" | "b") {
  const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const pawnSourceRow = byColor === "w" ? row + 1 : row - 1;

  for (const pawnCol of [col - 1, col + 1]) {
    if (inBounds(pawnSourceRow, pawnCol) && board[pawnSourceRow][pawnCol] === `${byColor}p`) {
      return true;
    }
  }

  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c) && board[r][c] === `${byColor}n`) {
      return true;
    }
  }

  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c) && board[r][c] === `${byColor}k`) {
      return true;
    }
  }

  const scan = (directions: number[][], attackers: string[]) => {
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;

      while (inBounds(r, c)) {
        const piece = board[r][c];
        if (piece) {
          if (piece[0] === byColor && attackers.includes(piece[1])) {
            return true;
          }
          break;
        }

        r += dr;
        c += dc;
      }
    }

    return false;
  };

  return (
    scan([[-1,0],[1,0],[0,-1],[0,1]], ["r", "q"]) ||
    scan([[-1,-1],[-1,1],[1,-1],[1,1]], ["b", "q"])
  );
}

function isKingInCheck(board: string[][], color: "w" | "b") {
  const kingPosition = findKing(board, color);
  if (!kingPosition) {
    return false;
  }

  const enemyColor = color === "w" ? "b" : "w";
  return isSquareAttacked(board, kingPosition[0], kingPosition[1], enemyColor);
}

function applyMoveForValidation(
  board: string[][],
  piece: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
) {
  const nextBoard = cloneBoard(board);
  const finalPiece = isPawnPromotionMove(piece, toRow) ? `${piece[0]}q` : piece;

  nextBoard[toRow][toCol] = finalPiece;
  nextBoard[fromRow][fromCol] = "";

  if (isCastlingMove(piece, fromRow, fromCol, toRow, toCol)) {
    const rookFromCol = toCol === 6 ? 7 : 0;
    const rookToCol = toCol === 6 ? 5 : 3;
    nextBoard[fromRow][rookToCol] = nextBoard[fromRow][rookFromCol];
    nextBoard[fromRow][rookFromCol] = "";
  }

  return nextBoard;
}

function isLegalMoveForKing(
  piece: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  board: string[][]
) {
  const nextBoard = applyMoveForValidation(board, piece, fromRow, fromCol, toRow, toCol);
  return !isKingInCheck(nextBoard, piece[0] as "w" | "b");
}

function getCastlingMoves(piece: string, fromRow: number, fromCol: number, board: string[][], rights: CastlingRights): [number, number][] {
  const color = piece[0];
  const homeRow = color === "w" ? 7 : 0;
  const king = color === "w" ? "wk" : "bk";
  const rook = color === "w" ? "wr" : "br";
  const kingSideRight = color === "w" ? rights.wK : rights.bK;
  const queenSideRight = color === "w" ? rights.wQ : rights.bQ;
  const moves: [number, number][] = [];

  if (piece !== king || fromRow !== homeRow || fromCol !== 4) {
    return moves;
  }

  const enemyColor = color === "w" ? "b" : "w";
  if (isSquareAttacked(board, homeRow, 4, enemyColor)) {
    return moves;
  }

  if (
    kingSideRight &&
    board[homeRow][7] === rook &&
    board[homeRow][5] === "" &&
    board[homeRow][6] === "" &&
    !isSquareAttacked(board, homeRow, 5, enemyColor) &&
    !isSquareAttacked(board, homeRow, 6, enemyColor)
  ) {
    moves.push([homeRow, 6]);
  }

  if (
    queenSideRight &&
    board[homeRow][0] === rook &&
    board[homeRow][1] === "" &&
    board[homeRow][2] === "" &&
    board[homeRow][3] === "" &&
    !isSquareAttacked(board, homeRow, 3, enemyColor) &&
    !isSquareAttacked(board, homeRow, 2, enemyColor)
  ) {
    moves.push([homeRow, 2]);
  }

  return moves;
}

function updateCastlingRightsForMove(
  rights: CastlingRights,
  piece: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  captured: string
): CastlingRights {
  const next = { ...rights };

  if (piece === "wk") {
    next.wK = false;
    next.wQ = false;
  }
  if (piece === "bk") {
    next.bK = false;
    next.bQ = false;
  }

  if (piece === "wr" && fromRow === 7 && fromCol === 7) next.wK = false;
  if (piece === "wr" && fromRow === 7 && fromCol === 0) next.wQ = false;
  if (piece === "br" && fromRow === 0 && fromCol === 7) next.bK = false;
  if (piece === "br" && fromRow === 0 && fromCol === 0) next.bQ = false;

  if (captured === "wr" && toRow === 7 && toCol === 7) next.wK = false;
  if (captured === "wr" && toRow === 7 && toCol === 0) next.wQ = false;
  if (captured === "br" && toRow === 0 && toCol === 7) next.bK = false;
  if (captured === "br" && toRow === 0 && toCol === 0) next.bQ = false;

  return next;
}

function getValidMoves(piece: string, fromRow: number, fromCol: number, board: string[][], rights: CastlingRights): [number, number][] {
  const color = piece[0];
  const type  = piece[1];
  const moves: [number, number][] = [];

  const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const isEmpty  = (r: number, c: number) => inBounds(r, c) && board[r][c] === "";
  const isEnemy  = (r: number, c: number) => inBounds(r, c) && board[r][c] !== "" && board[r][c][0] !== color;
  const canGo    = (r: number, c: number) => isEmpty(r, c) || isEnemy(r, c);

  const slide = (dr: number, dc: number) => {
    let r = fromRow + dr, c = fromCol + dc;
    while (inBounds(r, c)) {
      if (isEmpty(r, c)) { moves.push([r, c]); }
      else { if (isEnemy(r, c)) moves.push([r, c]); break; }
      r += dr; c += dc;
    }
  };
  const onlyLegalMoves = () =>
    moves.filter(([r, c]) => isLegalMoveForKing(piece, fromRow, fromCol, r, c, board));

  if (type === "p") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    if (isEmpty(fromRow + dir, fromCol)) {
      moves.push([fromRow + dir, fromCol]);
      if (fromRow === startRow && isEmpty(fromRow + 2 * dir, fromCol))
        moves.push([fromRow + 2 * dir, fromCol]);
    }
    [-1, 1].forEach(dc => { if (isEnemy(fromRow + dir, fromCol + dc)) moves.push([fromRow + dir, fromCol + dc]); });
    return onlyLegalMoves();
  }
  if (type === "n") {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
      .forEach(([dr, dc]) => { if (canGo(fromRow+dr, fromCol+dc)) moves.push([fromRow+dr, fromCol+dc]); });
    return onlyLegalMoves();
  }
  if (type === "b" || type === "q") { [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  if (type === "r" || type === "q") { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  if (type === "k") {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
      .forEach(([dr,dc]) => { if (canGo(fromRow+dr, fromCol+dc)) moves.push([fromRow+dr, fromCol+dc]); });
    getCastlingMoves(piece, fromRow, fromCol, board, rights).forEach((move) => moves.push(move));
  }
  return onlyLegalMoves();
}

/* ── ELO tier badge ──────────────────────────── */
function hasAnyLegalMove(board: string[][], color: "w" | "b", rights: CastlingRights) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];

      if (piece && piece[0] === color && getValidMoves(piece, row, col, board, rights).length > 0) {
        return true;
      }
    }
  }

  return false;
}

/* ── Captured pieces ─────────────────────────── */
function getTerminalStatusFromServer(status?: string): GameStatusType | null {
  // Backend status uses domain result names; UI only needs terminal display categories.
  if (!status || status === "playing" || status === "check") {
    return null;
  }

  if (status === "white_wins" || status === "black_wins") {
    return "checkmate";
  }

  if (status === "stalemate" || status.startsWith("draw_")) {
    return "draw";
  }

  return null;
}

function buildPieceCountMap(board: string[][]): Record<string, number> {
  const map: Record<string, number> = {};
  board.flat().forEach(p => { if (p) map[p] = (map[p] || 0) + 1; });
  return map;
}

function getCapturedPieces(board: string[][]): { whiteCaptured: string[]; blackCaptured: string[] } {
  const init = buildPieceCountMap(INITIAL_BOARD);
  const curr = buildPieceCountMap(board);
  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];

  const getMissingCount = (piece: string) => {
    const missingCount = Math.max(0, (init[piece] || 0) - (curr[piece] || 0));

    if (piece[1] !== "p") {
      return missingCount;
    }

    const colorPrefix = piece[0];
    const promotedPieceCount = ["q", "r", "b", "n"].reduce((total, type) => {
      const promotedPiece = `${colorPrefix}${type}`;
      return total + Math.max(0, (curr[promotedPiece] || 0) - (init[promotedPiece] || 0));
    }, 0);

    return Math.max(0, missingCount - promotedPieceCount);
  };

  CAPTURED_ORDER.forEach(t => {
    const w = `w${t}`, b = `b${t}`;
    for (let i = 0; i < getMissingCount(w); i++) whiteCaptured.push(w);
    for (let i = 0; i < getMissingCount(b); i++) blackCaptured.push(b);
  });
  return { whiteCaptured, blackCaptured };
}

/* ── Timer formatting ────────────────────────── */
function formatTime(ms: number): string {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── ChessPlayerCard ─────────────────────────── */
function ChessPlayerCard({
  name, colorSide, elo, avatarChar, timeMs, isActive, isTimerRunning,
}: {
  name: string; colorSide: PlayerColor; elo?: number; avatarChar: string;
  timeMs: number; isActive: boolean; isTimerRunning: boolean;
}) {
  const resolvedElo = elo ?? DEFAULT_ELO;
  const isLow      = timeMs > 0 && timeMs <= 30_000;
  const isCritical = timeMs > 0 && timeMs <= 10_000;

  return (
    <div className={`cb-player-row ${isActive ? "active" : ""}`}>
      <div className={`cb-player-avatar ${colorSide}`}>{avatarChar}</div>
      <div className="cb-player-info">
        <p className="cb-player-name">{name}</p>
        <div className="cb-player-meta">
          <span className="cb-elo-badge">Elo {resolvedElo}</span>
          <span className="cb-color-label">{colorSide === "white" ? "♔ Trắng" : "♚ Đen"}</span>
        </div>
      </div>
      <div className={[
        "cb-timer",
        isActive && isTimerRunning ? "active" : "",
        isLow && !isCritical ? "low" : "",
        isCritical ? "critical" : "",
      ].filter(Boolean).join(" ")}>
        {formatTime(timeMs)}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────── */
function ChessBoardUI() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const routeState = (location.state as BoardRouteState | null) ?? null;
  const currentUser = useMemo(() => getAuthenticatedUser(), []);

  const roomName    = routeState?.roomName    || "Phòng đấu nhanh";
  const timeMinutes = routeState?.timeControl ?? 5;
  const bonusSec    = routeState?.bonusSeconds ?? 0;
  const INITIAL_TIME_MS = (typeof timeMinutes === "number" ? timeMinutes : 5) * 60_000;
  const socketRoomId = routeState?.roomId;
  const socketPlayerColor = routeState?.playerColor;
  const isOnlineRoom = Boolean(socketRoomId);
  const isSocketGame = Boolean(socketRoomId && getSocketToken());

  /* ── Board state ── */
  const [boardHistory,   setBoardHistory  ] = useState<string[][][]>([cloneBoard(INITIAL_BOARD)]);
  const [moves,          setMoves         ] = useState<MoveNotation[]>([]);
  const [selectedCell,   setSelectedCell  ] = useState<{ row: number; col: number } | null>(null);
  const [validMoveSet,   setValidMoveSet  ] = useState<Set<string>>(new Set());
  const [captureMoveSet, setCaptureMoveSet] = useState<Set<string>>(new Set());
  const [currentViewIdx, setCurrentViewIdx] = useState(0);
  const [gameStatus,     setGameStatus    ] = useState<GameStatusType>("your-turn");
  const [activeTab,      setActiveTab     ] = useState<SidebarTab>("info");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "reconnecting" | "disconnected">(
    isSocketGame ? "connecting" : "connected"
  );
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [currentTurn, setCurrentTurn] = useState<PlayerColor>("white");
  const [castlingRights, setCastlingRights] = useState<CastlingRights>(INITIAL_CASTLING_RIGHTS);
  const [gameChatMessages, setGameChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [playerElo, setPlayerElo] = useState(routeState?.playerElo ?? currentUser.elo ?? DEFAULT_ELO);
  const [opponentElo, setOpponentElo] = useState(routeState?.opponentElo ?? DEFAULT_ELO);
  const [eloResultMessage, setEloResultMessage] = useState<string | undefined>();
  const [socketStatusMessage, setSocketStatusMessage] = useState<string | undefined>();
  const [gameResultNotice, setGameResultNotice] = useState<GameResultNotice>(null);
  const [resultCountdownSeconds, setResultCountdownSeconds] = useState(RESULT_AUTO_LEAVE_SECONDS);
  const [pendingDrawOffer, setPendingDrawOffer] = useState<DrawOfferPayload | null>(null);

  /* ── Timer state ── */
  const [whiteTimeMs,    setWhiteTimeMs   ] = useState(INITIAL_TIME_MS);
  const [blackTimeMs,    setBlackTimeMs   ] = useState(INITIAL_TIME_MS);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leaveAfterGameOverRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameOverHandledRef = useRef(false);
  const boardSocketRef = useRef<ReturnType<typeof getAppSocket>>(null);
  const joinedRoomRef = useRef<string | null>(null);
  const lastAppliedMoveCountRef = useRef(0);
  const lastAppliedMoveSignatureRef = useRef<string | null>(null);

  const latestBoard    = boardHistory[boardHistory.length - 1];
  const displayedBoard = boardHistory[currentViewIdx] || boardHistory[0];
  const isViewingLatest = currentViewIdx === boardHistory.length - 1;
  const displayedTurn: PlayerColor = isViewingLatest
    ? currentTurn
    : currentViewIdx % 2 === 0 ? "white" : "black";

  /* Players */
  const bottomColor = socketPlayerColor ?? "white";
  const topColor = bottomColor === "white" ? "black" : "white";
  const opponentName = routeState?.opponentName || "Đối thủ";
  const topPlayer = {
    name: opponentName,
    colorSide: topColor as PlayerColor,
    elo: opponentElo,
    avatarChar: (opponentName.slice(0, 1).toUpperCase()) || "D",
  };
  const bottomPlayer = {
    name: getUserDisplayName(currentUser),
    colorSide: bottomColor as PlayerColor,
    elo: playerElo,
    avatarChar: (currentUser.username.slice(0, 1).toUpperCase()) || "U",
  };

  const checkedKing = useMemo(() => {
    const turnColor = displayedTurn === "white" ? "w" : "b";

    if (!isKingInCheck(displayedBoard, turnColor)) {
      return null;
    }

    const position = findKing(displayedBoard, turnColor);
    if (!position) {
      return null;
    }

    return {
      color: displayedTurn,
      row: position[0],
      col: position[1],
      isCurrentPlayer: displayedTurn === bottomPlayer.colorSide,
      hasLegalMove: hasAnyLegalMove(displayedBoard, turnColor, castlingRights),
    };
  }, [bottomPlayer.colorSide, castlingRights, displayedBoard, displayedTurn]);

  const checkStatusMessage = checkedKing?.isCurrentPlayer
    ? "Vua của bạn đang bị chiếu. Nước tiếp theo bắt buộc phải che chiếu, bắt quân chiếu hoặc di chuyển vua."
    : undefined;
  const statusMessage = eloResultMessage ?? checkStatusMessage ?? socketStatusMessage;
  const getBoardSocket = useCallback(() => boardSocketRef.current ?? getAppSocket(), []);

  const leaveBoard = useCallback(() => {
    if (leaveAfterGameOverRef.current) {
      window.clearTimeout(leaveAfterGameOverRef.current);
      leaveAfterGameOverRef.current = null;
    }
    if (resultCountdownRef.current) {
      window.clearInterval(resultCountdownRef.current);
      resultCountdownRef.current = null;
    }

    const socket = getBoardSocket();
    if (socketRoomId) {
      socket?.emit("leave_room", { roomId: socketRoomId });
    }
    navigate("/lobby", { replace: true });
    const lobbyHash = "#/lobby";
    window.setTimeout(() => {
      if (window.location.hash !== lobbyHash) {
        window.location.hash = lobbyHash;
      }
    }, 0);
    window.setTimeout(() => {
      if (window.location.hash !== lobbyHash) {
        window.location.assign(`${window.location.origin}${window.location.pathname}${lobbyHash}`);
      }
    }, 150);
  }, [getBoardSocket, navigate, socketRoomId]);

  const leaveBoardAfterGameOver = useCallback(() => {
    if (leaveAfterGameOverRef.current) {
      window.clearTimeout(leaveAfterGameOverRef.current);
    }
    if (resultCountdownRef.current) {
      window.clearInterval(resultCountdownRef.current);
    }

    setResultCountdownSeconds(RESULT_AUTO_LEAVE_SECONDS);
    resultCountdownRef.current = setInterval(() => {
      setResultCountdownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    leaveAfterGameOverRef.current = setTimeout(() => {
      leaveBoard();
    }, RESULT_AUTO_LEAVE_SECONDS * 1000);
  }, [leaveBoard]);

  const applyTimerSnapshot = useCallback((timer: TimerSyncPayload["timer"]) => {
    if (!timer) {
      setIsTimerRunning(false);
      return;
    }

    setWhiteTimeMs(timer.whiteTimeLeft * 1000);
    setBlackTimeMs(timer.blackTimeLeft * 1000);
    setCurrentTurn(timer.currentTurn);
    setIsTimerRunning(true);
  }, []);

  const finishGameFromPayload = useCallback((payload: SocketGameStatePayload, options: { forceNotice?: boolean } = {}) => {
    const nextNotice = {
      title: getResultTitle(payload, bottomPlayer.colorSide),
      message: getResultMessage(payload, bottomPlayer.colorSide),
    };

    setGameResultNotice((currentNotice) => options.forceNotice ? nextNotice : currentNotice ?? nextNotice);

    if (!gameOverHandledRef.current) {
      gameOverHandledRef.current = true;
    }
    leaveBoardAfterGameOver();
  }, [bottomPlayer.colorSide, leaveBoardAfterGameOver]);

  useEffect(() => {
    return () => {
      if (leaveAfterGameOverRef.current) {
        window.clearTimeout(leaveAfterGameOverRef.current);
      }
      if (resultCountdownRef.current) {
        window.clearInterval(resultCountdownRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameResultNotice && resultCountdownSeconds <= 0) {
      leaveBoard();
    }
  }, [gameResultNotice, leaveBoard, resultCountdownSeconds]);

  /* ── Timer tick ── */
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (!isTimerRunning) return;
    const gameOver = ["checkmate","draw","disconnected","resigned","timeout-win","timeout-loss"].includes(gameStatus);
    if (gameOver) return;

    timerIntervalRef.current = setInterval(() => {
      if (displayedTurn === "white") {
        setWhiteTimeMs(prev => {
          if (prev <= 0) { setIsTimerRunning(false); setGameStatus("timeout-loss"); return 0; }
          return prev - 100;
        });
      } else {
        setBlackTimeMs(prev => {
          if (prev <= 0) { setIsTimerRunning(false); setGameStatus("timeout-win"); return 0; }
          return prev - 100;
        });
      }
    }, 100);

    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimerRunning, displayedTurn, gameStatus]);

  /* ── Valid moves highlight ── */
  const updateValidMoves = useCallback((row: number, col: number, board: string[][]) => {
    const piece = board[row][col];
    if (!piece) { setValidMoveSet(new Set()); setCaptureMoveSet(new Set()); return; }
    const rawMoves = getValidMoves(piece, row, col, board, castlingRights);
    const vMoves = new Set<string>();
    const cMoves = new Set<string>();
    rawMoves.forEach(([r, c]) => {
      if (board[r][c]) cMoves.add(`${r}-${c}`);
      else             vMoves.add(`${r}-${c}`);
    });
    setValidMoveSet(vMoves);
    setCaptureMoveSet(cMoves);
  }, [castlingRights]);

  const applySocketGameState = useCallback((
    payload: SocketGameStatePayload,
    options: { replaceHistory?: boolean } = {}
  ) => {
    const terminalStatus = getTerminalStatusFromServer(payload.gameStatus);
    const isTerminalPayload = Boolean(payload.reason || terminalStatus);
    const moveSignature = payload.from && payload.to
      ? [
          payload.roomId,
          payload.from.row,
          payload.from.col,
          payload.to.row,
          payload.to.col,
          payload.currentTurn,
          payload.moveCount ?? "no-count",
        ].join(":")
      : null;

    if (!isTerminalPayload && !options.replaceHistory && moveSignature && moveSignature === lastAppliedMoveSignatureRef.current) {
      if (payload.timer !== undefined) {
        applyTimerSnapshot(payload.timer);
      }
      return;
    }

    if (
      !isTerminalPayload &&
      !options.replaceHistory &&
      payload.moveCount !== undefined &&
      payload.moveCount <= lastAppliedMoveCountRef.current
    ) {
      if (payload.timer !== undefined) {
        applyTimerSnapshot(payload.timer);
      }
      return;
    }

    if (payload.moveCount !== undefined) {
      lastAppliedMoveCountRef.current = payload.moveCount;
    }

    if (options.replaceHistory) {
      lastAppliedMoveSignatureRef.current = null;
    } else if (moveSignature) {
      lastAppliedMoveSignatureRef.current = moveSignature;
    }

    const serverBoard = mapSocketBoardToUiBoard(payload.board);

    setBoardHistory((prev) => {
      const previousBoard = prev[prev.length - 1] ?? INITIAL_BOARD;
      const nextBoard = cloneBoard(serverBoard);

      if (!options.replaceHistory && areBoardsEqual(previousBoard, nextBoard)) {
        setCurrentViewIdx(prev.length - 1);
        return prev;
      }

      if (options.replaceHistory) {
        setMoves([]);
        setCastlingRights(INITIAL_CASTLING_RIGHTS);
      } else if (payload.from && payload.to) {
        const movingPiece = previousBoard[payload.from.row]?.[payload.from.col] ?? "";
        const captured = previousBoard[payload.to.row]?.[payload.to.col] ?? "";
        const promotionPiece = payload.promotionPiece
          ? UI_PROMOTION_MAP[payload.promotionPiece]
          : undefined;

        if (movingPiece) {
          setCastlingRights((rights) => {
            const nextRights = updateCastlingRightsForMove(
              rights,
              movingPiece,
              payload.from!.row,
              payload.from!.col,
              payload.to!.row,
              payload.to!.col,
              captured
            );
            const baseNotation = getMoveNotation(
              movingPiece,
              payload.from!.row,
              payload.from!.col,
              payload.to!.row,
              payload.to!.col,
              captured,
              promotionPiece
            );
            const notation = appendCheckSuffix(
              baseNotation,
              nextBoard,
              payload.currentTurn,
              nextRights
            );

            setMoves((prevMoves) => [...prevMoves, { notation }]);
            return nextRights;
          });
        }
      }

      const nextHistory = options.replaceHistory
        ? [cloneBoard(nextBoard)]
        : [...prev, cloneBoard(nextBoard)];
      setCurrentViewIdx(nextHistory.length - 1);
      return nextHistory;
    });

    setCurrentTurn(payload.currentTurn);
    setSocketStatusMessage(undefined);
    if (payload.timer !== undefined) {
      applyTimerSnapshot(payload.timer);
    }
    if (payload.eloUpdate) {
      const bottomIsWhite = bottomPlayer.colorSide === "white";
      // Socket payload is white/black based; convert it to local player/opponent based on board orientation.
      const nextPlayerElo = bottomIsWhite ? payload.eloUpdate.whiteNextElo : payload.eloUpdate.blackNextElo;
      const playerDelta = bottomIsWhite ? payload.eloUpdate.whiteDelta : payload.eloUpdate.blackDelta;
      setPlayerElo(nextPlayerElo);
      setOpponentElo(bottomIsWhite ? payload.eloUpdate.blackNextElo : payload.eloUpdate.whiteNextElo);
      const eloText = `Elo ${playerDelta >= 0 ? "+" : ""}${playerDelta} -> ${nextPlayerElo}`;
      if (payload.reason === "resign") {
        setEloResultMessage(
          payload.eloUpdate.result === bottomPlayer.colorSide
            ? `Đối thủ đầu hàng. ${eloText}`
            : `Bạn đã đầu hàng. ${eloText}`
        );
      } else if (payload.reason === "opponent_left") {
        setEloResultMessage(
          payload.eloUpdate.result === bottomPlayer.colorSide
            ? `Đối thủ rời phòng. ${eloText}`
            : `Bạn đã rời phòng. ${eloText}`
        );
      } else if (payload.reason === "draw_agreement") {
        setEloResultMessage(`Hai bên đồng ý hòa. ${eloText}`);
      } else {
        setEloResultMessage(eloText);
      }
    } else if (payload.reason) {
      setEloResultMessage(getResultMessage(payload, bottomPlayer.colorSide));
    } else {
      setEloResultMessage(undefined);
    }

    // Prefer server terminal status when available; otherwise compute check/turn locally for immediate feedback.
    const resignedStatus =
      payload.reason === "resign"
        ? getWinnerFromPayload(payload) === bottomPlayer.colorSide ? "checkmate" : "resigned"
        : null;
    setGameStatus(
      resignedStatus ??
        terminalStatus ??
        (isKingInCheck(serverBoard, payload.currentTurn === "white" ? "w" : "b")
          ? "check"
          : payload.currentTurn === bottomPlayer.colorSide ? "your-turn" : "opponent-turn")
    );
    if (payload.reason || terminalStatus) {
      setIsTimerRunning(false);
    }
    setConnectionStatus("connected");
    setSelectedCell(null);
    setValidMoveSet(new Set());
    setCaptureMoveSet(new Set());
    setPendingPromotion(null);
  }, [applyTimerSnapshot, bottomPlayer.colorSide]);

  useEffect(() => {
    if (!socketRoomId) {
      return;
    }

    const socket = getBoardSocket();
    boardSocketRef.current = socket;

    if (!socket) {
      setConnectionStatus("disconnected");
      setGameStatus("disconnected");
      return;
    }

    const handleRoomJoined = (payload: SocketGameStatePayload) => {
      if (payload.roomId === socketRoomId) {
        if (joinedRoomRef.current !== socketRoomId) {
          joinedRoomRef.current = socketRoomId;
          applySocketGameState(payload, { replaceHistory: true });
          socket.emit("game:ready", { roomId: socketRoomId, gameId: routeState?.gameId ?? socketRoomId });
          socket.emit("timer:sync", { roomId: socketRoomId });
        }
      }
    };

    const handleChessMove = (payload: SocketGameStatePayload) => {
      if (payload.roomId === socketRoomId) {
        applySocketGameState(payload);
      }
    };

    const handleGameOver = (payload: SocketGameStatePayload) => {
      if (payload.roomId === socketRoomId) {
        setPendingDrawOffer(null);
        applySocketGameState(payload);
        finishGameFromPayload(payload, {
          forceNotice: payload.reason === "resign" || payload.reason === "draw_agreement",
        });
      }
    };

    const handleTimerSync = (payload: TimerSyncPayload) => {
      if (payload.roomId === socketRoomId) {
        applyTimerSnapshot(payload.timer);
      }
    };

    const handleGameTimeout = (payload: { loser: PlayerColor; winner: PlayerColor }) => {
      const didWin = payload.winner === bottomPlayer.colorSide;
      const message = didWin
        ? "Bạn thắng: đối thủ đã hết giờ."
        : "Bạn thua: bạn đã hết giờ.";
      setGameResultNotice({ title: didWin ? "Bạn thắng" : "Bạn thua", message });
      leaveBoardAfterGameOver();
    };

    const handleGameError = (payload: { message: string }) => {
      setGameStatus(getTurnStatus(currentTurn, bottomPlayer.colorSide));
      setSocketStatusMessage(payload.message || "Không thể thực hiện thao tác này.");
      console.warn(payload.message);
    };

    const handleRoomError = (message: string) => {
      setGameStatus("disconnected");
      setSocketStatusMessage(message || "Phòng đấu gặp lỗi kết nối.");
      console.warn(message);
    };

    const handlePlayerLeft = (payload: { userId: string }) => {
      if (payload.userId === currentUser.id || gameOverHandledRef.current) {
        return;
      }

      setPendingDrawOffer(null);
      gameOverHandledRef.current = true;
      setIsTimerRunning(false);
      setConnectionStatus("connected");
      setGameStatus("checkmate");
      setGameResultNotice({
        title: "Bạn thắng",
        message: "Bạn thắng: đối thủ đã rời phòng.",
      });
      leaveBoardAfterGameOver();
    };

    const handleDrawOffer = (payload: DrawOfferPayload) => {
      if (payload.roomId !== socketRoomId || payload.offeredBy === currentUser.id) {
        return;
      }

      setPendingDrawOffer(payload);
    };

    const handleDrawDeclined = (payload: DrawDeclinedPayload) => {
      if (payload.roomId === socketRoomId) {
        setPendingDrawOffer(null);
        window.alert(`${payload.username} đã từ chối hòa.`);
      }
    };

    const handleReceiveMessage = (payload: RoomMessagePayload) => {
      // Chat ván đấu lấy payload từ server để hai client có cùng id và timestamp.
      setGameChatMessages((prevMessages) => [
        ...prevMessages,
        {
          id: payload.id || `${Date.now()}-${payload.username}`,
          sender: payload.username,
          text: payload.message,
          timestamp: new Date(payload.timestamp).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isOwn: payload.username === currentUser.username,
        },
      ]);
    };

    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
      setGameStatus("disconnected");
    };

    socket.on("room_joined", handleRoomJoined);
    socket.on("chess_move", handleChessMove);
    socket.on("game_over", handleGameOver);
    socket.on("timer:sync", handleTimerSync);
    socket.on("game_timeout", handleGameTimeout);
    socket.on("game_error", handleGameError);
    socket.on("room_error", handleRoomError);
    socket.on("player_left", handlePlayerLeft);
    socket.on("draw:offer", handleDrawOffer);
    socket.on("draw:declined", handleDrawDeclined);
    socket.on("chat", handleReceiveMessage);
    socket.on("disconnect", handleDisconnect);

    setConnectionStatus(socket.connected ? "connected" : "connecting");
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join_room", { roomId: socketRoomId });

    return () => {
      socket.off("room_joined", handleRoomJoined);
      socket.off("chess_move", handleChessMove);
      socket.off("game_over", handleGameOver);
      socket.off("timer:sync", handleTimerSync);
      socket.off("game_timeout", handleGameTimeout);
      socket.off("game_error", handleGameError);
      socket.off("room_error", handleRoomError);
      socket.off("player_left", handlePlayerLeft);
      socket.off("draw:offer", handleDrawOffer);
      socket.off("draw:declined", handleDrawDeclined);
      socket.off("chat", handleReceiveMessage);
      socket.off("disconnect", handleDisconnect);
    };
  }, [applySocketGameState, applyTimerSnapshot, bottomPlayer.colorSide, currentUser.id, currentUser.username, finishGameFromPayload, getBoardSocket, leaveBoardAfterGameOver, socketRoomId]);

  const handleSendGameChatMessage = (message: string) => {
    const socket = getBoardSocket();

    if (!socket || !socketRoomId) {
      return;
    }

    // Chat trong ván dùng roomId game hiện tại, backend sẽ broadcast lại cho cả hai người chơi.
    socket.emit("chat", {
      roomId: socketRoomId,
      message,
    });
  };

  const handleOfferDraw = () => {
    if (!isOnlineRoom || !socketRoomId) {
      setGameStatus("draw");
      return;
    }

    const socket = getBoardSocket();
    if (!socket) {
      setConnectionStatus("disconnected");
      return;
    }
    if (!socket.connected) {
      setConnectionStatus("connecting");
      socket.connect();
    }

    socket.emit("draw:offer", { roomId: socketRoomId }, (response) => {
      if (!response.ok) {
        console.warn(response.message || "Draw offer failed");
        return;
      }

      if (response.reason === "draw_agreement") {
        setPendingDrawOffer(null);
        if (response.board && response.currentTurn) {
          applySocketGameState(response as SocketGameStatePayload);
        }
        finishGameFromPayload(response as SocketGameStatePayload, { forceNotice: true });
        return;
      }

      setSocketStatusMessage("Đã gửi đề nghị hòa. Đang chờ đối thủ phản hồi.");
      window.alert("Đã gửi đề nghị hòa cho đối thủ.");
    });
  };

  const handleAcceptDrawOffer = () => {
    if (!socketRoomId) {
      setPendingDrawOffer(null);
      return;
    }

    const socket = getBoardSocket();
    if (!socket) {
      setConnectionStatus("disconnected");
      return;
    }
    if (!socket.connected) {
      setConnectionStatus("connecting");
      socket.connect();
    }

    socket.emit("draw:accept", { roomId: socketRoomId }, (response) => {
      if (!response.ok) {
        console.warn(response.message || "Draw response failed");
        setSocketStatusMessage(response.message || "Không thể chấp nhận hòa.");
        return;
      }

      setPendingDrawOffer(null);
      if (response.board && response.currentTurn) {
        applySocketGameState(response as SocketGameStatePayload);
      }
      finishGameFromPayload(response as SocketGameStatePayload, { forceNotice: true });
    });
  };

  const handleDeclineDrawOffer = () => {
    if (socketRoomId) {
      getBoardSocket()?.emit("draw:decline", { roomId: socketRoomId });
    }
    setPendingDrawOffer(null);
  };

  const handleResign = () => {
    if (!window.confirm("Bạn chắc chắn muốn đầu hàng ván này?")) {
      return;
    }

    gameOverHandledRef.current = true;
    setIsTimerRunning(false);
    setGameStatus("resigned");
    setEloResultMessage("Bạn thua: bạn đã đầu hàng.");
    setGameResultNotice({
      title: "Bạn thua",
      message: "Bạn thua: bạn đã đầu hàng.",
    });
    leaveBoardAfterGameOver();

    if (!isOnlineRoom || !socketRoomId) {
      return;
    }

    const socket = getBoardSocket();
    if (!socket) {
      setConnectionStatus("disconnected");
      return;
    }
    if (!socket.connected) {
      setConnectionStatus("connecting");
      socket.connect();
    }

    socket.emit("game:resign", { roomId: socketRoomId }, (response) => {
      if (!response.ok) {
        console.warn(response.message || "Resign failed");
        return;
      }

      if (response.board && response.currentTurn) {
        applySocketGameState(response as SocketGameStatePayload);
      }
      finishGameFromPayload(response as SocketGameStatePayload);
    });
  };

  /* ── Handle cell click ── */
  const emitSocketMove = (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    promotionPiece?: PromotionPiece
  ) => {
    if (!socketRoomId) {
      return false;
    }

    const movingPiece = latestBoard[fromRow]?.[fromCol];
    const isCurrentPlayerTurn = currentTurn === bottomPlayer.colorSide;
    const isOwnPiece = movingPiece?.startsWith(getColorPrefix(bottomPlayer.colorSide));

    if (!movingPiece || !isCurrentPlayerTurn || !isOwnPiece) {
      setSocketStatusMessage(
        !movingPiece
          ? "Không có quân cờ ở ô đã chọn."
          : !isCurrentPlayerTurn
            ? "Chưa đến lượt bạn."
            : "Bạn không thể di chuyển quân của đối thủ."
      );
      console.warn(
        `Blocked illegal online move ${formatSquare(fromRow, fromCol)} -> ${formatSquare(toRow, toCol)}`
      );
      setGameStatus(getTurnStatus(currentTurn, bottomPlayer.colorSide));
      setPendingPromotion(null);
      setSelectedCell(null);
      setValidMoveSet(new Set());
      setCaptureMoveSet(new Set());
      return false;
    }

    const socket = getBoardSocket();
    if (!socket) {
      setConnectionStatus("disconnected");
      setGameStatus("disconnected");
      return false;
    }

    socket.emit(
      "chess_move",
      {
        roomId: socketRoomId,
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        promotionPiece: promotionPiece ? SOCKET_PROMOTION_MAP[promotionPiece] : undefined,
      },
      (response) => {
        if (!response.ok) {
          setGameStatus(getTurnStatus(currentTurn, bottomPlayer.colorSide));
          setSocketStatusMessage(response.message || "Nước đi không hợp lệ.");
          console.warn(response.message || "Invalid socket move");
        }
      }
    );

    setPendingPromotion(null);
    setSelectedCell(null);
    setValidMoveSet(new Set());
    setCaptureMoveSet(new Set());
    return true;
  };

  const finishMove = (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    promotionPiece?: PromotionPiece
  ) => {
    const newBoard    = cloneBoard(latestBoard);
    const movingPiece = newBoard[fromRow][fromCol];
    const captured    = newBoard[toRow][toCol];
    const finalPiece  = promotionPiece ? `${movingPiece[0]}${promotionPiece}` : movingPiece;
    const baseNotation = getMoveNotation(movingPiece, fromRow, fromCol, toRow, toCol, captured, promotionPiece);
    const isCastling = isCastlingMove(movingPiece, fromRow, fromCol, toRow, toCol);

    newBoard[toRow][toCol] = finalPiece;
    newBoard[fromRow][fromCol] = "";

    if (isCastling) {
      const rookFromCol = toCol === 6 ? 7 : 0;
      const rookToCol = toCol === 6 ? 5 : 3;
      newBoard[fromRow][rookToCol] = newBoard[fromRow][rookFromCol];
      newBoard[fromRow][rookFromCol] = "";
    }

    const nextCastlingRights = updateCastlingRightsForMove(
      castlingRights,
      movingPiece,
      fromRow,
      fromCol,
      toRow,
      toCol,
      captured
    );
    const nextTurn = displayedTurn === "white" ? "black" : "white";
    const notation = appendCheckSuffix(baseNotation, newBoard, nextTurn, nextCastlingRights);
    const nextHistory = [...boardHistory, cloneBoard(newBoard)];
    setBoardHistory(nextHistory);
    setMoves(prev => [...prev, { notation }]);
    setCastlingRights(nextCastlingRights);
    setCurrentViewIdx(nextHistory.length - 1);
    setPendingPromotion(null);
    setSelectedCell(null); setValidMoveSet(new Set()); setCaptureMoveSet(new Set());

    if (bonusSec > 0) {
      if (displayedTurn === "white") setWhiteTimeMs(prev => prev + bonusSec * 1000);
      else                            setBlackTimeMs(prev => prev + bonusSec * 1000);
    }

    if (!isTimerRunning) setIsTimerRunning(true);

    const nextTurnPrefix = nextTurn === "white" ? "w" : "b";
    const nextTurnInCheck = isKingInCheck(newBoard, nextTurnPrefix);
    setCurrentTurn(nextTurn);
    setGameStatus(
      nextTurnInCheck && !hasAnyLegalMove(newBoard, nextTurnPrefix, nextCastlingRights)
        ? "checkmate"
        : nextTurnInCheck
          ? "check"
          : nextTurn === bottomPlayer.colorSide ? "your-turn" : "opponent-turn"
    );
  };

  const handlePromotionSelect = (promotionPiece: PromotionPiece) => {
    if (!pendingPromotion) {
      return;
    }

    if (isOnlineRoom) {
      emitSocketMove(
        pendingPromotion.fromRow,
        pendingPromotion.fromCol,
        pendingPromotion.toRow,
        pendingPromotion.toCol,
        promotionPiece
      );
      return;
    }

    finishMove(
      pendingPromotion.fromRow,
      pendingPromotion.fromCol,
      pendingPromotion.toRow,
      pendingPromotion.toCol,
      promotionPiece
    );
  };

  const handleCellClick = (row: number, col: number) => {
    if (!isViewingLatest) return;
    if (pendingPromotion) return;
    const ended = ["draw","checkmate","disconnected","resigned","timeout-win","timeout-loss"].includes(gameStatus);
    if (ended) return;

    const clickedPiece = latestBoard[row][col];
    const turnPrefix   = getColorPrefix(displayedTurn);
    const playerPrefix = getColorPrefix(bottomPlayer.colorSide);
    const canControlTurn = !isOnlineRoom || displayedTurn === bottomPlayer.colorSide;
    const canSelectPiece = (piece: string) =>
      piece.startsWith(turnPrefix) &&
      (!isOnlineRoom || (canControlTurn && piece.startsWith(playerPrefix)));
    const key          = `${row}-${col}`;

    if (selectedCell === null) {
      if (clickedPiece && canSelectPiece(clickedPiece)) {
        setSelectedCell({ row, col });
        updateValidMoves(row, col, latestBoard);
      }
      return;
    }

    if (selectedCell.row === row && selectedCell.col === col) {
      setSelectedCell(null); setValidMoveSet(new Set()); setCaptureMoveSet(new Set());
      return;
    }

    if (clickedPiece && canSelectPiece(clickedPiece)) {
      setSelectedCell({ row, col });
      updateValidMoves(row, col, latestBoard);
      return;
    }

    const movingPiece = latestBoard[selectedCell.row][selectedCell.col];
    const isEnemyTarget = Boolean(clickedPiece && movingPiece && clickedPiece[0] !== movingPiece[0]);
    const isValidDest = validMoveSet.has(key) || captureMoveSet.has(key);
    if (!isValidDest && !(isOnlineRoom && isEnemyTarget)) {
      setSelectedCell(null); setValidMoveSet(new Set()); setCaptureMoveSet(new Set());
      return;
    }

    if (isPawnPromotionMove(movingPiece, row)) {
      setPendingPromotion({
        fromRow: selectedCell.row,
        fromCol: selectedCell.col,
        toRow: row,
        toCol: col,
      });
      return;
    }

    if (isOnlineRoom) {
      emitSocketMove(selectedCell.row, selectedCell.col, row, col);
      return;
    }

    finishMove(selectedCell.row, selectedCell.col, row, col);
  };

  /* ── Replay controls ── */
  const clearSelection = () => { setSelectedCell(null); setValidMoveSet(new Set()); setCaptureMoveSet(new Set()); };
  const goFirst  = () => { clearSelection(); setCurrentViewIdx(0); };
  const goPrev   = () => { clearSelection(); setCurrentViewIdx(p => Math.max(p - 1, 0)); };
  const goNext   = () => { clearSelection(); setCurrentViewIdx(p => Math.min(p + 1, boardHistory.length - 1)); };
  const goLast   = () => { clearSelection(); setCurrentViewIdx(boardHistory.length - 1); };
  const jumpToMove = (idx: number) => { clearSelection(); setCurrentViewIdx(idx); };

  /* ── Grouped moves ── */
  const groupedMoves = useMemo(() => {
    const groups: { turn: number; white: string; wi: number; black: string; bi: number }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      groups.push({ turn: Math.floor(i / 2) + 1, white: moves[i]?.notation || "", wi: i + 1, black: moves[i+1]?.notation || "", bi: i + 2 });
    }
    return groups;
  }, [moves]);

  /* ── Captured pieces ── */
  const capturedPieces = useMemo(() => getCapturedPieces(displayedBoard), [displayedBoard]);
  const boardViewCells = useMemo(
    () => getBoardViewCells(displayedBoard, bottomPlayer.colorSide),
    [bottomPlayer.colorSide, displayedBoard]
  );

  const getTimeForColor = (color: PlayerColor) => color === "white" ? whiteTimeMs : blackTimeMs;
  const moveCount = Math.max(0, boardHistory.length - 1);

  /* ── Auto-scroll move list ── */
  const moveListEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { moveListEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [moves]);

  const isTerminalStatus = ["draw","checkmate","disconnected","resigned","timeout-win","timeout-loss"].includes(gameStatus);
  const turnStatus = displayedTurn === bottomPlayer.colorSide ? "your-turn" : "opponent-turn";
  const currentPlayerCheckStatus: GameStatusType | null = checkedKing?.isCurrentPlayer
    ? checkedKing.hasLegalMove ? "check" : "checkmate"
    : null;
  const displayStatus: GameStatusType = isViewingLatest
    ? isTerminalStatus
      ? gameStatus
      : currentPlayerCheckStatus ?? (gameStatus === "check" ? turnStatus : gameStatus)
    : currentPlayerCheckStatus ?? turnStatus;

  /* ── Render ── */
  return (
    <div className="chess-app">
      <div className="chess-shell">

        {/* ══ LEFT COLUMN ══ */}
        <div className="chess-main">

          <ChessPlayerCard
            name={topPlayer.name}
            colorSide={topPlayer.colorSide}
            elo={topPlayer.elo}
            avatarChar={topPlayer.avatarChar}
            timeMs={getTimeForColor(topPlayer.colorSide)}
            isActive={displayedTurn === topPlayer.colorSide}
            isTimerRunning={isTimerRunning}
          />

          <GameStatusUI status={displayStatus} message={statusMessage} />

          <div className="board-section">
            <div className="board-frame">
              <div className="board-grid">
                {boardViewCells.map(({ key, visualRow, visualCol, row, col, cell }) => {
                  const isDark    = (row + col) % 2 === 1;
                  const isSelected = selectedCell?.row === row && selectedCell?.col === col;
                  const logicalKey = `${row}-${col}`;
                  const isValid   = validMoveSet.has(logicalKey);
                  const isCapture = captureMoveSet.has(logicalKey);
                  const isCheckedKing = checkedKing?.row === row && checkedKing.col === col;

                  return (
                    <div
                      key={key}
                      className={[
                        "square",
                        isDark ? "dark" : "light",
                        isSelected ? "selected" : "",
                        isValid    ? "valid-move"    : "",
                        isCapture  ? "valid-capture" : "",
                        isCheckedKing ? "checked-king" : "",
                      ].join(" ")}
                      onClick={() => handleCellClick(row, col)}
                    >
                      {visualCol === 0 && <span className="rank-label">{getRankNumber(row)}</span>}
                      {visualRow === 7 && <span className="file-label">{FILES[col]}</span>}
                      {cell && (
                        <img
                          src={getPieceImage(cell)}
                          alt={getPieceName(cell)}
                          className="piece-image"
                          draggable={false}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <ChessPlayerCard
            name={bottomPlayer.name}
            colorSide={bottomPlayer.colorSide}
            elo={bottomPlayer.elo}
            avatarChar={bottomPlayer.avatarChar}
            timeMs={getTimeForColor(bottomPlayer.colorSide)}
            isActive={displayedTurn === bottomPlayer.colorSide}
            isTimerRunning={isTimerRunning}
          />
        </div>

        {/* ══ RIGHT SIDEBAR ══ */}
        <div className="chess-sidebar">

          {/* Tab bar — info | chat | moves */}
          <div className="cb-tabs">
            {(["info", "chat", "moves"] as SidebarTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                className={`cb-tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "info" ? "ℹ️ Phòng" : tab === "chat" ? "💬 Chat" : "📋 Nước đi"}
              </button>
            ))}
          </div>

          <div className="cb-tab-content">

            {/* ── INFO TAB ── */}
            {activeTab === "info" && (
              <div className="cb-info-wrap">

                {/* Kết nối — dùng ConnectionStatusUI compact */}
                <div className="cb-info-section">
                  <p className="cb-info-title">Kết nối</p>
                  <ConnectionStatusUI
                    compact
                    status={connectionStatus}
                    serverName="Game Server"
                    onRetry={() => setConnectionStatus("connecting")}
                  />
                </div>

                {/* Thông tin phòng */}
                <div className="cb-info-section">
                  <p className="cb-info-title">Phòng đấu</p>
                  <div className="cb-room-row"><span>Phòng</span><strong>{roomName}</strong></div>
                  <div className="cb-room-row">
                    <span>Thời gian</span>
                    <strong>{typeof timeMinutes === "number" ? `${timeMinutes} phút` : "Tuỳ chọn"}</strong>
                  </div>
                  {bonusSec > 0 && (
                    <div className="cb-room-row"><span>Cộng mỗi nước</span><strong>+{bonusSec}s</strong></div>
                  )}
                  <div className="cb-room-row">
                    <span>Lượt hiện tại</span>
                    <strong>{displayedTurn === "white" ? "Trắng" : "Đen"}</strong>
                  </div>
                  <div className="cb-room-row"><span>Số nước đã đi</span><strong>{moveCount}</strong></div>
                </div>

                {/* Quân đã bị ăn */}
                <div className="cb-info-section">
                  <p className="cb-info-title">Quân đã bị ăn</p>
                  <div className="cb-captured-row">
                    <span className="cb-captured-label">Trắng</span>
                    <div className="cb-captured-pieces">
                      {capturedPieces.whiteCaptured.length > 0
                        ? capturedPieces.whiteCaptured.map((p, i) => (
                            <img key={`wc-${i}`} src={getPieceImage(p)} alt="" className="cb-captured-piece-img" draggable={false} />
                          ))
                        : <span className="cb-captured-empty">—</span>
                      }
                    </div>
                  </div>
                  <div className="cb-captured-row">
                    <span className="cb-captured-label">Đen</span>
                    <div className="cb-captured-pieces">
                      {capturedPieces.blackCaptured.length > 0
                        ? capturedPieces.blackCaptured.map((p, i) => (
                            <img key={`bc-${i}`} src={getPieceImage(p)} alt="" className="cb-captured-piece-img" draggable={false} />
                          ))
                        : <span className="cb-captured-empty">—</span>
                      }
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── CHAT TAB ── */}
            {activeTab === "chat" && (
              <div className="cb-chat-wrap">
                <ChatUI
                  roomName={roomName}
                  currentUserName={getUserDisplayName(currentUser)}
                  initialMessages={INITIAL_CHAT}
                  messages={isSocketGame ? gameChatMessages : undefined}
                  onSendText={isSocketGame ? handleSendGameChatMessage : undefined}
                />
              </div>
            )}

            {/* ── MOVES TAB ── */}
            {activeTab === "moves" && (
              <div className="cb-moves-wrap">
                <div className="cb-move-list">
                  {groupedMoves.length > 0 ? (
                    <>
                      <div className="cb-move-head">
                        <span>#</span><span>Trắng</span><span>Đen</span>
                      </div>
                      {groupedMoves.map(m => (
                        <div className="cb-move-row" key={m.turn}>
                          <span>{m.turn}.</span>
                          <span>
                            {m.white
                              ? <button className={`cb-notation-btn ${currentViewIdx === m.wi ? "active" : ""}`} onClick={() => jumpToMove(m.wi)}>{m.white}</button>
                              : "—"}
                          </span>
                          <span>
                            {m.black
                              ? <button className={`cb-notation-btn ${currentViewIdx === m.bi ? "active" : ""}`} onClick={() => jumpToMove(m.bi)}>{m.black}</button>
                              : "—"}
                          </span>
                        </div>
                      ))}
                      <div ref={moveListEndRef} />
                    </>
                  ) : (
                    <div className="cb-moves-empty">
                      <div className="cb-moves-empty-icon">♟</div>
                    </div>
                  )}
                </div>

                <div className="cb-replay-controls">
                  <button className="cb-replay-btn" onClick={goFirst} disabled={currentViewIdx === 0}                      title="Đầu">⏮</button>
                  <button className="cb-replay-btn" onClick={goPrev}  disabled={currentViewIdx === 0}                      title="Lùi">‹</button>
                  <button className="cb-replay-btn" onClick={goNext}  disabled={currentViewIdx === boardHistory.length - 1} title="Tiến">›</button>
                  <button className="cb-replay-btn" onClick={goLast}  disabled={currentViewIdx === boardHistory.length - 1} title="Cuối">⏭</button>
                </div>
              </div>
            )}

          </div>

          {/* ── PANEL ĐẦU HÀNG / CẦU HÒA — luôn hiện, nằm ngoài tab-content ── */}
          <div className="cb-game-actions-panel">
            <button type="button" className="cb-action-btn draw" onClick={handleOfferDraw} disabled={isTerminalStatus}>🤝 Cầu hòa</button>
            <button type="button" className="cb-action-btn resign" onClick={handleResign} disabled={isTerminalStatus}>🏳 Đầu hàng</button>
            <button type="button" className="cb-action-btn leave" onClick={leaveBoard}>← Rời phòng</button>
          </div>

        </div>
      </div>

      {pendingPromotion && (
        <div className="cb-promotion-overlay" role="dialog" aria-modal="true">
          <div className="cb-promotion-panel">
            <p className="cb-promotion-kicker">Phong cấp</p>
            <h2>Chọn quân thay thế</h2>
            <div className="cb-promotion-options">
              {PROMOTION_OPTIONS.map((option) => {
                const movingPiece =
                  latestBoard[pendingPromotion.fromRow][pendingPromotion.fromCol];
                const promotedPiece = `${movingPiece[0]}${option.type}`;

                return (
                  <button
                    type="button"
                    key={option.type}
                    className="cb-promotion-option"
                    onClick={() => handlePromotionSelect(option.type)}
                  >
                    <img
                      src={getPieceImage(promotedPiece)}
                      alt={option.label}
                      draggable={false}
                    />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {pendingDrawOffer && !gameResultNotice && (
        <div className="cb-result-overlay" role="dialog" aria-modal="true">
          <div className="cb-result-panel cb-draw-offer-panel">
            <p className="cb-result-kicker">Đề nghị hòa</p>
            <h2>Đối thủ muốn hòa</h2>
            <p>{pendingDrawOffer.username} đề nghị kết thúc ván đấu với kết quả hòa.</p>
            <div className="cb-draw-offer-actions">
              <button type="button" className="cb-result-btn secondary" onClick={handleDeclineDrawOffer}>
                Từ chối
              </button>
              <button type="button" className="cb-result-btn" onClick={handleAcceptDrawOffer}>
                Đồng ý hòa
              </button>
            </div>
          </div>
        </div>
      )}

      {gameResultNotice && (
        <div className="cb-result-overlay" role="dialog" aria-modal="true" onClick={leaveBoard}>
          <div className="cb-result-panel" onClick={(event) => event.stopPropagation()}>
            <p className="cb-result-kicker">Kết quả ván đấu</p>
            <h2>{gameResultNotice.title}</h2>
            <p>{gameResultNotice.message}</p>
            {eloResultMessage && <span className="cb-result-elo">{eloResultMessage}</span>}
            <p className="cb-result-countdown">
              Tự về sảnh sau <strong>{resultCountdownSeconds}s</strong>. Nhấn vào màn hình để rời ngay.
            </p>
            <button type="button" className="cb-result-btn" onClick={leaveBoard}>
              Rời phòng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChessBoardUI;
