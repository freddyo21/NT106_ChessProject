import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./ChessBoardUI.css";
import GameStatusUI, { GameStatusType } from "../GameStatusUI/GameStatusUI";
import ChatUI, { type ChatMessage } from "../ChatUI/ChatUI";
import ConnectionStatusUI from "../ConnectionStatusUI/ConnectionStatusUI";

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

type DemoSessionUser = {
  email: string;
  displayName: string;
  username: string;
};

type BoardRouteState = {
  roomId?: string;
  roomName?: string;
  roomCode?: string;
  timeControl?: number;
  bonusSeconds?: number;
};

type MoveNotation = { notation: string };

/* ── Constants ───────────────────────────────── */
const USER_STORAGE_KEY = "zess_demo_user";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const CAPTURED_ORDER = ["q", "r", "b", "n", "p", "k"];

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

/* ── Helpers ─────────────────────────────────── */
function getDemoUser(): DemoSessionUser {
  const fallback: DemoSessionUser = { email: "admin@gmail.com", displayName: "Người chơi", username: "admin" };
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as DemoSessionUser;
    return parsed.displayName && parsed.username ? parsed : fallback;
  } catch { return fallback; }
}

function cloneBoard(b: string[][]): string[][] { return b.map(r => [...r]); }
function getPieceImage(piece: string): string { return PIECE_IMAGE_MAP[piece] || ""; }

function getPieceName(piece: string): string {
  const names: Record<string, string> = {
    wk:"Vua trắng", wq:"Hậu trắng", wr:"Xe trắng", wb:"Tượng trắng", wn:"Mã trắng", wp:"Tốt trắng",
    bk:"Vua đen",  bq:"Hậu đen",  br:"Xe đen",  bb:"Tượng đen",  bn:"Mã đen",  bp:"Tốt đen",
  };
  return names[piece] || "";
}

function formatSquare(row: number, col: number): string { return `${FILES[col]}${8 - row}`; }
function getRankNumber(row: number): number { return 8 - row; }

function getMoveNotation(piece: string, fromCol: number, toRow: number, toCol: number, captured: string): string {
  const dest = formatSquare(toRow, toCol);
  const isCapture = captured !== "";
  const type = piece[1];
  if (type === "p") return isCapture ? `${FILES[fromCol]}x${dest}` : dest;
  const letters: Record<string, string> = { k:"K", q:"Q", r:"R", b:"B", n:"N" };
  return `${letters[type] || ""}${isCapture ? "x" : ""}${dest}`;
}

/* ── Valid moves engine ───────────────────────── */
function getValidMoves(piece: string, fromRow: number, fromCol: number, board: string[][]): [number, number][] {
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

  if (type === "p") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    if (isEmpty(fromRow + dir, fromCol)) {
      moves.push([fromRow + dir, fromCol]);
      if (fromRow === startRow && isEmpty(fromRow + 2 * dir, fromCol))
        moves.push([fromRow + 2 * dir, fromCol]);
    }
    [-1, 1].forEach(dc => { if (isEnemy(fromRow + dir, fromCol + dc)) moves.push([fromRow + dir, fromCol + dc]); });
    return moves;
  }
  if (type === "n") {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
      .forEach(([dr, dc]) => { if (canGo(fromRow+dr, fromCol+dc)) moves.push([fromRow+dr, fromCol+dc]); });
    return moves;
  }
  if (type === "b" || type === "q") { [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  if (type === "r" || type === "q") { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  if (type === "k") {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
      .forEach(([dr,dc]) => { if (canGo(fromRow+dr, fromCol+dc)) moves.push([fromRow+dr, fromCol+dc]); });
  }
  return moves;
}

/* ── ELO tier badge ──────────────────────────── */
function getEloTier(elo: number): { tier: string; label: string } {
  if (elo >= 1900) return { tier: "master", label: `Master · ${elo}` };
  if (elo >= 1600) return { tier: "gold",   label: `Vàng · ${elo}` };
  if (elo >= 1300) return { tier: "silver", label: `Bạc · ${elo}` };
  return { tier: "bronze", label: `Đồng · ${elo}` };
}

/* ── Captured pieces ─────────────────────────── */
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
  CAPTURED_ORDER.forEach(t => {
    const w = `w${t}`, b = `b${t}`;
    for (let i = 0; i < (init[w] || 0) - (curr[w] || 0); i++) whiteCaptured.push(w);
    for (let i = 0; i < (init[b] || 0) - (curr[b] || 0); i++) blackCaptured.push(b);
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
  const { tier, label } = getEloTier(elo ?? 1200);
  const isLow      = timeMs > 0 && timeMs <= 30_000;
  const isCritical = timeMs > 0 && timeMs <= 10_000;

  return (
    <div className={`cb-player-row ${isActive ? "active" : ""}`}>
      <div className={`cb-player-avatar ${colorSide}`}>{avatarChar}</div>
      <div className="cb-player-info">
        <p className="cb-player-name">{name}</p>
        <div className="cb-player-meta">
          <span className={`cb-elo-badge ${tier}`}>{label}</span>
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
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = (location.state as BoardRouteState | null) ?? null;
  const currentUser = useMemo(() => getDemoUser(), []);

  const roomName    = routeState?.roomName    || "Phòng đấu nhanh";
  const timeMinutes = routeState?.timeControl ?? 5;
  const bonusSec    = routeState?.bonusSeconds ?? 0;
  const INITIAL_TIME_MS = (typeof timeMinutes === "number" ? timeMinutes : 5) * 60_000;

  /* ── Board state ── */
  const [boardHistory,   setBoardHistory  ] = useState<string[][][]>([cloneBoard(INITIAL_BOARD)]);
  const [moves,          setMoves         ] = useState<MoveNotation[]>([]);
  const [selectedCell,   setSelectedCell  ] = useState<{ row: number; col: number } | null>(null);
  const [validMoveSet,   setValidMoveSet  ] = useState<Set<string>>(new Set());
  const [captureMoveSet, setCaptureMoveSet] = useState<Set<string>>(new Set());
  const [currentViewIdx, setCurrentViewIdx] = useState(0);
  const [gameStatus,     setGameStatus    ] = useState<GameStatusType>("your-turn");
  const [activeTab,      setActiveTab     ] = useState<SidebarTab>("info");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "reconnecting" | "disconnected">("connected");

  /* ── Timer state ── */
  const [whiteTimeMs,    setWhiteTimeMs   ] = useState(INITIAL_TIME_MS);
  const [blackTimeMs,    setBlackTimeMs   ] = useState(INITIAL_TIME_MS);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const latestBoard    = boardHistory[boardHistory.length - 1];
  const displayedBoard = boardHistory[currentViewIdx] || boardHistory[0];
  const displayedTurn: PlayerColor = currentViewIdx % 2 === 0 ? "white" : "black";
  const isViewingLatest = currentViewIdx === boardHistory.length - 1;

  /* Players */
  const topPlayer = { name: "Đối thủ", colorSide: "black" as PlayerColor, elo: 1480, avatarChar: "D" };
  const bottomPlayer = {
    name: currentUser.displayName || currentUser.username,
    colorSide: "white" as PlayerColor,
    elo: 1420,
    avatarChar: (currentUser.username.slice(0, 1).toUpperCase()) || "U",
  };

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
    const rawMoves = getValidMoves(piece, row, col, board);
    const vMoves = new Set<string>();
    const cMoves = new Set<string>();
    rawMoves.forEach(([r, c]) => {
      if (board[r][c]) cMoves.add(`${r}-${c}`);
      else             vMoves.add(`${r}-${c}`);
    });
    setValidMoveSet(vMoves);
    setCaptureMoveSet(cMoves);
  }, []);

  /* ── Handle cell click ── */
  const handleCellClick = (row: number, col: number) => {
    if (!isViewingLatest) return;
    const ended = ["draw","checkmate","disconnected","resigned","timeout-win","timeout-loss"].includes(gameStatus);
    if (ended) return;

    const clickedPiece = latestBoard[row][col];
    const turnPrefix   = displayedTurn === "white" ? "w" : "b";
    const key          = `${row}-${col}`;

    if (selectedCell === null) {
      if (clickedPiece && clickedPiece.startsWith(turnPrefix)) {
        setSelectedCell({ row, col });
        updateValidMoves(row, col, latestBoard);
      }
      return;
    }

    if (selectedCell.row === row && selectedCell.col === col) {
      setSelectedCell(null); setValidMoveSet(new Set()); setCaptureMoveSet(new Set());
      return;
    }

    if (clickedPiece && clickedPiece.startsWith(turnPrefix)) {
      setSelectedCell({ row, col });
      updateValidMoves(row, col, latestBoard);
      return;
    }

    const isValidDest = validMoveSet.has(key) || captureMoveSet.has(key);
    if (!isValidDest) {
      setSelectedCell(null); setValidMoveSet(new Set()); setCaptureMoveSet(new Set());
      return;
    }

    /* Execute move */
    const newBoard    = cloneBoard(latestBoard);
    const movingPiece = newBoard[selectedCell.row][selectedCell.col];
    const captured    = newBoard[row][col];
    const notation    = getMoveNotation(movingPiece, selectedCell.col, row, col, captured);

    newBoard[row][col] = movingPiece;
    newBoard[selectedCell.row][selectedCell.col] = "";

    const nextHistory = [...boardHistory, cloneBoard(newBoard)];
    setBoardHistory(nextHistory);
    setMoves(prev => [...prev, { notation }]);
    setCurrentViewIdx(nextHistory.length - 1);
    setSelectedCell(null); setValidMoveSet(new Set()); setCaptureMoveSet(new Set());

    if (bonusSec > 0) {
      if (displayedTurn === "white") setWhiteTimeMs(prev => prev + bonusSec * 1000);
      else                            setBlackTimeMs(prev => prev + bonusSec * 1000);
    }

    if (!isTimerRunning) setIsTimerRunning(true);

    const nextTurn = displayedTurn === "white" ? "black" : "white";
    setGameStatus(nextTurn === bottomPlayer.colorSide ? "your-turn" : "opponent-turn");
  };

  /* ── Replay controls ── */
  const clearSelection = () => { setSelectedCell(null); setValidMoveSet(new Set()); setCaptureMoveSet(new Set()); };
  const goFirst  = () => { clearSelection(); setCurrentViewIdx(0); };
  const goPrev   = () => { clearSelection(); setCurrentViewIdx(p => Math.max(p - 1, 0)); };
  const goNext   = () => { clearSelection(); setCurrentViewIdx(p => Math.min(p + 1, boardHistory.length - 1)); };
  const goLast   = () => { clearSelection(); setCurrentViewIdx(boardHistory.length - 1); };
  const jumpToMove = (idx: number) => { clearSelection(); setCurrentViewIdx(idx); };

  const handleBackToLobby = () => navigate("/lobby");

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

  /* ── Auto-scroll move list ── */
  const moveListEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { moveListEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [moves]);

  const displayStatus: GameStatusType = isViewingLatest
    ? gameStatus
    : displayedTurn === bottomPlayer.colorSide ? "your-turn" : "opponent-turn";

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
            timeMs={blackTimeMs}
            isActive={displayedTurn === "black"}
            isTimerRunning={isTimerRunning}
          />

          <GameStatusUI status={displayStatus} />

          <div className="board-section">
            <div className="board-frame">
              <div className="board-grid">
                {displayedBoard.map((rowArr, rowIdx) =>
                  rowArr.map((cell, colIdx) => {
                    const isDark    = (rowIdx + colIdx) % 2 === 1;
                    const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                    const key       = `${rowIdx}-${colIdx}`;
                    const isValid   = validMoveSet.has(key);
                    const isCapture = captureMoveSet.has(key);

                    return (
                      <div
                        key={key}
                        className={[
                          "square",
                          isDark ? "dark" : "light",
                          isSelected ? "selected" : "",
                          isValid    ? "valid-move"    : "",
                          isCapture  ? "valid-capture" : "",
                        ].join(" ")}
                        onClick={() => handleCellClick(rowIdx, colIdx)}
                      >
                        {colIdx === 0 && <span className="rank-label">{getRankNumber(rowIdx)}</span>}
                        {rowIdx === 7 && <span className="file-label">{FILES[colIdx]}</span>}
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
                  })
                )}
              </div>
            </div>
          </div>

          <ChessPlayerCard
            name={bottomPlayer.name}
            colorSide={bottomPlayer.colorSide}
            elo={bottomPlayer.elo}
            avatarChar={bottomPlayer.avatarChar}
            timeMs={whiteTimeMs}
            isActive={displayedTurn === "white"}
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
                  <div className="cb-room-row"><span>Số nước đã đi</span><strong>{moves.length}</strong></div>
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
                  currentUserName={currentUser.displayName || currentUser.username}
                  initialMessages={INITIAL_CHAT}
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
            <button type="button" className="cb-action-btn draw"   onClick={() => setGameStatus("draw")}>🤝 Cầu hòa</button>
            <button type="button" className="cb-action-btn resign" onClick={() => setGameStatus("resigned")}>🏳 Đầu hàng</button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ChessBoardUI;