import type { AiDifficulty } from "../websocket/room-management.socket";
import type { GameRoom, PromotionPiece } from "../types/Gameplay";
import type { Position } from "../types/Position";

export const AI_MOVE_DELAY_MS = 450;

const PIECE_VALUES = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 100,
};

const AI_DIFFICULTIES = new Set<AiDifficulty>(["easy", "medium", "hard"]);
const CHECK_BONUS = 4;
const CHECKMATE_SCORE = 10_000;

type AiMoveCandidate = { from: Position; to: Position; score: number; promotionPiece?: PromotionPiece };
export type AiMove = { from: Position; to: Position; promotionPiece?: PromotionPiece };

export const isAiDifficulty = (value: unknown): value is AiDifficulty =>
    typeof value === "string" && AI_DIFFICULTIES.has(value as AiDifficulty);

const getGameResultFromStatus = (status: string): "white" | "black" | "draw" | null => {
    if (status === "white_wins") return "white";
    if (status === "black_wins") return "black";
    if (
        status === "stalemate" ||
        status === "draw_insufficient_material" ||
        status === "draw_fifty_move_rule"
    ) {
        return "draw";
    }

    return null;
};

const getAiMoveCandidates = (room: GameRoom): AiMoveCandidate[] => {
    const board = room.game.getBoard();
    const turn = room.game.getCurrentTurn();
    const candidates: AiMoveCandidate[] = [];

    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const piece = room.game.getPieceAt({ row, col });

            if (!piece || piece.color !== turn) {
                continue;
            }

            const legalMoves = room.game.getLegalMoves({ row, col });
            for (const move of legalMoves) {
                const target = board[move.row]?.[move.col] ?? null;
                const captureScore = target && target.color !== piece.color ? PIECE_VALUES[target.type] * 10 : 0;
                const centerScore = 4 - (Math.abs(3.5 - move.row) + Math.abs(3.5 - move.col));
                const candidate = {
                    from: { row, col },
                    to: move,
                    score: captureScore + centerScore + Math.random(),
                };

                candidates.push(
                    piece.type === "pawn" && move.row === 7
                        ? { ...candidate, promotionPiece: "queen" }
                        : candidate
                );
            }
        }
    }

    return candidates;
};

const evaluateBoardForBlack = (room: GameRoom): number => {
    const status = room.game.getGameStatus();
    if (status === "black_wins") return CHECKMATE_SCORE;
    if (status === "white_wins") return -CHECKMATE_SCORE;
    if (getGameResultFromStatus(status) === "draw") return 0;

    let score = 0;
    const board = room.game.getBoard();

    for (const row of board) {
        for (const piece of row) {
            if (!piece) continue;
            const value = PIECE_VALUES[piece.type];
            score += piece.color === "black" ? value : -value;
        }
    }

    if (status === "check") {
        score += room.game.getCurrentTurn() === "white" ? CHECK_BONUS : -CHECK_BONUS;
    }

    return score;
};

const minimaxForBlack = (room: GameRoom, depth: number): number => {
    const terminalResult = getGameResultFromStatus(room.game.getGameStatus());
    if (depth <= 0 || terminalResult) {
        return evaluateBoardForBlack(room);
    }

    const candidates = getAiMoveCandidates(room);
    if (candidates.length === 0) {
        return evaluateBoardForBlack(room);
    }

    const isBlackTurn = room.game.getCurrentTurn() === "black";
    let bestScore = isBlackTurn ? -Infinity : Infinity;

    for (const candidate of candidates) {
        const moved = room.game.movePiece(candidate.from, candidate.to, candidate.promotionPiece);
        if (!moved) continue;

        const score = minimaxForBlack(room, depth - 1);
        room.game.undoMove();
        bestScore = isBlackTurn ? Math.max(bestScore, score) : Math.min(bestScore, score);
    }

    return Number.isFinite(bestScore) ? bestScore : evaluateBoardForBlack(room);
};

const simulateMoveScore = (room: GameRoom, candidate: AiMoveCandidate, depth: number): number => {
    const moved = room.game.movePiece(candidate.from, candidate.to, candidate.promotionPiece);
    if (!moved) {
        return -CHECKMATE_SCORE;
    }

    const score = minimaxForBlack(room, depth - 1);
    room.game.undoMove();
    return score;
};

export const chooseAiMove = (room: GameRoom): AiMove | null => {
    const difficulty = room.aiDifficulty ?? "medium";
    const candidates = getAiMoveCandidates(room);

    if (candidates.length === 0) {
        return null;
    }

    if (difficulty === "easy") {
        const captureCandidates = candidates.filter((candidate) => candidate.score >= 10);
        const pool = captureCandidates.length > 0 && Math.random() < 0.35 ? captureCandidates : candidates;
        return pool[Math.floor(Math.random() * pool.length)] ?? null;
    }

    if (difficulty === "hard") {
        candidates.forEach((candidate) => {
            candidate.score = simulateMoveScore(room, candidate, 2) + Math.random() * 0.01;
        });
    } else {
        candidates.forEach((candidate) => {
            candidate.score += simulateMoveScore(room, candidate, 1) * 2;
        });
    }

    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates[0]!;
    return {
        from: selected.from,
        to: selected.to,
        ...(selected.promotionPiece ? { promotionPiece: selected.promotionPiece } : {}),
    };
};
