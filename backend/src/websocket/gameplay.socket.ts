import { Socket } from "socket.io";
import { ChessMovePayloadSchema, DEFAULT_ELO, GameReadyPayloadSchema, JoinRoomPayloadSchema, TimerSyncPayloadSchema } from "@zess-online-chess/shared";
import { Position } from "../types/Position";
import { createAiGameRoom, getGameRoom, type AiDifficulty } from "./room-management.socket";
import { updatePresenceElo } from "./presence.socket";
import { AuthorizedRoomContext, GameActionCallback, GameRoom, GameStatePayload, PromotionPiece } from "../types/Gameplay";
import { InvalidMoveException } from "../exceptions";
import { applyMatchEloResult } from "../services/elo.service";
import { createTimer, destroyTimer, getSnapshot, hasTimer, startTimer, switchTurn, TIME_CONTROLS } from "../services/timer.service";
import { AI_MOVE_DELAY_MS, chooseAiMove, isAiDifficulty } from "../services/chess-ai.service";
import { buildGameStatePayload } from "../utils/game-payload";
import * as gameRepository from "../repositories/game.repository";
import * as leaderboardService from "../services/leaderboard.service";
import type { PieceColor } from "../types/GameResult";
import type { TimeControlType } from "../types/TimeControl";
import { Logger } from "../utils/Logger";

const PROMOTION_PIECES: PromotionPiece[] = ["queen", "rook", "bishop", "knight"];
const DEFAULT_TIME_CONTROL: TimeControlType = "blitz";
const roomToGameId = new Map<string, string>();
const drawOffers = new Map<string, string>();

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

export const gameplaySocket = (socket: Socket) => {
    const logger = new Logger("gameplay-socket");

    const emitRatingRealtimeUpdates = async (userIds: string[]) => {
        const uniqueUserIds = [...new Set(userIds)];

        const statsList = await Promise.all(
            uniqueUserIds.map((userId) => leaderboardService.getPlayerProfileStats(userId))
        );

        statsList.forEach((stats) => {
            socket.nsp.to(`user:${stats.userId}`).emit("profile:stats_updated", stats);
        });
        socket.nsp.emit("leaderboard:changed");
    };

    const emitGameError = (callback: GameActionCallback | undefined, err: unknown) => {
        const message = err instanceof Error ? err.message : "Unknown game error";
        socket.emit("game_error", { message });
        callback?.({ ok: false, message });
    };

    const getAuthorizedRoomContext = (roomId: string): AuthorizedRoomContext => {
        if (!roomId) throw new Error("Missing roomId");
        if (!socket.rooms.has(roomId)) throw new Error("You are not in this room");

        const room = getGameRoom(roomId);
        if (!room) throw new Error("Room not found");
        if (room.players.length < 2) throw new Error("Need two players in the room");
        if (room.ratedResult) throw new Error("Game already ended");

        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player) throw new Error("Player not found in room");

        return { room, player };
    };

    const isAiRoom = (roomId: string, room: GameRoom) =>
        roomId.startsWith("ai-") || room.players.some((player) => player.userId === "ai-bot");

    const scheduleAiMove = (roomId: string) => {
        setTimeout(async () => {
            const room = getGameRoom(roomId);

            if (!room || !isAiRoom(roomId, room) || room.ratedResult || room.game.getCurrentTurn() !== "black") {
                return;
            }

            const aiMove = chooseAiMove(room);
            if (!aiMove) {
                await handleGameEnd(roomId, room);
                return;
            }

            const moved = room.game.movePiece(aiMove.from, aiMove.to, aiMove.promotionPiece);
            if (!moved) {
                socket.nsp.to(roomId).emit("game_error", { message: "AI could not make a legal move" });
                return;
            }

            const gameStatus = room.game.getGameStatus();
            const isGameOver = getGameResultFromStatus(gameStatus) !== null;
            const timerSnapshot = isGameOver ? null : await switchTurn(roomId);

            if (isGameOver) {
                await handleGameEnd(roomId, room);
            }

            socket.nsp.to(roomId).emit("chess_move", {
                ...buildGameStatePayload(roomId, room),
                timer: timerSnapshot,
                from: aiMove.from,
                to: aiMove.to,
                ...(aiMove.promotionPiece ? { promotionPiece: aiMove.promotionPiece } : {}),
            });
        }, AI_MOVE_DELAY_MS);
    };

    const applyRatedResult = async (
        room: GameRoom,
        result: "white" | "black" | "draw",
        reason: "checkmate" | "resign" | "draw_agreement" = "checkmate"
    ) => {
        if (room.ratedResult) {
            return;
        }

        if (room.players.some((player) => player.userId === "ai-bot")) {
            return;
        }

        const whitePlayer = room.players.find((player) => player.color === "white");
        const blackPlayer = room.players.find((player) => player.color === "black");

        if (!whitePlayer || !blackPlayer) {
            return;
        }

        const eloResult = await applyMatchEloResult({
            whiteUserId: whitePlayer.userId,
            blackUserId: blackPlayer.userId,
            whiteElo: whitePlayer.elo,
            blackElo: blackPlayer.elo,
            result,
        });

        whitePlayer.elo = eloResult.whiteNextElo;
        blackPlayer.elo = eloResult.blackNextElo;
        const updatedWhitePresence = updatePresenceElo(whitePlayer.userId, eloResult.whiteNextElo);
        const updatedBlackPresence = updatePresenceElo(blackPlayer.userId, eloResult.blackNextElo);
        if (updatedWhitePresence) socket.nsp.emit("presence:user_online", updatedWhitePresence);
        if (updatedBlackPresence) socket.nsp.emit("presence:user_online", updatedBlackPresence);
        room.ratedResult = {
            result,
            whiteDelta: eloResult.whiteDelta,
            blackDelta: eloResult.blackDelta,
            whiteNextElo: eloResult.whiteNextElo,
            blackNextElo: eloResult.blackNextElo,
        };

        if (room.gameId) {
            const [whiteRating, blackRating] = await Promise.all([
                gameRepository.getRatingOrDefault(whitePlayer.userId),
                gameRepository.getRatingOrDefault(blackPlayer.userId),
            ]);
            const gameResult = result === "white" ? "white_win" : result === "black" ? "black_win" : "draw";

            await Promise.all([
                gameRepository.updateRating({
                    userId: whitePlayer.userId,
                    newRating: eloResult.whiteNextElo,
                    result: result === "white" ? "win" : result === "black" ? "loss" : "draw",
                }),
                gameRepository.updateRating({
                    userId: blackPlayer.userId,
                    newRating: eloResult.blackNextElo,
                    result: result === "black" ? "win" : result === "white" ? "loss" : "draw",
                }),
                gameRepository.finishGame({
                    gameId: room.gameId,
                    result: gameResult,
                    terminationReason: reason,
                    winnerId: result === "white" ? whitePlayer.userId : result === "black" ? blackPlayer.userId : null,
                    moveCount: room.game.getMoveCount(),
                }),
                gameRepository.insertRatingHistory(whitePlayer.userId, room.gameId, whiteRating.rating, eloResult.whiteNextElo),
                gameRepository.insertRatingHistory(blackPlayer.userId, room.gameId, blackRating.rating, eloResult.blackNextElo),
            ]);

            await emitRatingRealtimeUpdates([whitePlayer.userId, blackPlayer.userId]);
        }
    };

    const applyRatedResultIfNeeded = async (room: GameRoom) => {
        if (room.players.some((player) => player.userId === "ai-bot")) {
            return;
        }

        const result = getGameResultFromStatus(room.game.getGameStatus());

        if (!result) {
            return;
        }

        await applyRatedResult(room, result);
    };

    const emitManualGameOver = async (
        roomId: string,
        room: GameRoom,
        result: "white" | "black" | "draw",
        gameStatus: "white_wins" | "black_wins" | "draw_agreement",
        reason: "resign" | "draw_agreement",
    ) => {
        destroyTimer(roomId);
        roomToGameId.delete(roomId);
        drawOffers.delete(roomId);
        try {
            await applyRatedResult(room, result, reason);
        } catch (error) {
            logger.error("Failed to persist manual game result", { roomId, reason, error });
        }

        const payload = {
            ...buildGameStatePayload(roomId, room),
            gameStatus,
            reason,
            eloUpdate: room.ratedResult,
            timer: null,
        };

        socket.nsp.to(roomId).emit("game_over", payload);
        room.players.forEach((player) => {
            if (player.socketId !== "__ai__") {
                socket.nsp.to(player.socketId).emit("game_over", payload);
            }
        });
    };

    const handleGameEnd = async (roomId: string, room: GameRoom, timedOutColor?: PieceColor) => {
        destroyTimer(roomId);
        roomToGameId.delete(roomId);
        await applyRatedResultIfNeeded(room);

        if (timedOutColor) {
            socket.nsp.to(roomId).emit("game_timeout", {
                loser: timedOutColor,
                winner: timedOutColor === "white" ? "black" : "white",
            });
        }

        socket.nsp.to(roomId).emit("game_over", {
            ...buildGameStatePayload(roomId, room),
            eloUpdate: room.ratedResult,
            timer: null,
        });
    };

    const runGameAction = async <T extends object = Record<string, never>>({
        roomId,
        eventName,
        callback,
        action,
    }: {
        roomId: string;
        eventName: string;
        callback?: GameActionCallback<T>;
        action: (context: AuthorizedRoomContext) => T | void;
    }) => {
        try {
            const context = getAuthorizedRoomContext(roomId);
            const extraPayload = action(context) ?? ({} as T);
            await applyRatedResultIfNeeded(context.room);

            const gameStatus = context.room.game.getGameStatus();
            const isGameOver = getGameResultFromStatus(gameStatus) !== null;
            const timerSnapshot = isGameOver ? null : await switchTurn(roomId);

            if (isGameOver) {
                await handleGameEnd(roomId, context.room);
            }

            const payload: GameStatePayload & T = {
                ...buildGameStatePayload(roomId, context.room),
                eloUpdate: context.room.ratedResult,
                timer: timerSnapshot,
                ...extraPayload,
            };

            socket.nsp.to(roomId).emit(eventName, payload);
            (callback as ((response: { ok: true }) => void) | undefined)?.({ ok: true });

            if (eventName === "chess_move" && isAiRoom(roomId, context.room) && context.room.game.getCurrentTurn() === "black") {
                scheduleAiMove(roomId);
            }
        } catch (err) {
            emitGameError(callback, err);
        }
    };

    socket.on("ai:start", (data?: { difficulty?: AiDifficulty } | GameActionCallback, callback?: GameActionCallback) => {
        const user = socket.data.user;
        const userId = user?.id;
        const resolvedCallback = typeof data === "function" ? data : callback;
        const requestedDifficulty = typeof data === "object" ? data?.difficulty : undefined;
        const difficulty = isAiDifficulty(requestedDifficulty)
            ? requestedDifficulty
            : "medium";

        if (!userId) {
            return emitGameError(resolvedCallback, new Error("Missing authenticated user"));
        }

        const roomId = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const room = createAiGameRoom(roomId, {
            userId,
            socketId: socket.id,
            username: user?.username || "Player",
            elo: typeof user?.elo === "number" ? user.elo : DEFAULT_ELO,
        }, difficulty);

        socket.join(roomId);
        createTimer(
            roomId,
            roomId,
            TIME_CONTROLS[DEFAULT_TIME_CONTROL],
            (timedOutColor) => {
                const currentRoom = getGameRoom(roomId);
                if (!currentRoom) return;

                void handleGameEnd(roomId, currentRoom, timedOutColor);
            }
        );
        startTimer(roomId);

        resolvedCallback?.({
            ok: true,
            ...buildGameStatePayload(roomId, room),
            timer: getSnapshot(roomId),
        });
    });

    socket.on("game:ready", (data) => {
        const result = GameReadyPayloadSchema.safeParse(data);

        if (!result.success) {
            return socket.emit("game_error", { message: "Invalid game ready payload" });
        }

        const { roomId, gameId } = result.data;
        const room = getGameRoom(roomId);

        if (!room || room.players.length < 2) return;
        if (getSnapshot(roomId)) return;

        const resolvedGameId = room.gameId ?? gameId ?? roomId;
        roomToGameId.set(roomId, resolvedGameId);

        const timeControl = TIME_CONTROLS[DEFAULT_TIME_CONTROL];

        createTimer(
            roomId,
            resolvedGameId,
            timeControl,
            (timedOutColor) => {
                const currentRoom = getGameRoom(roomId);
                if (!currentRoom) return;

                void handleGameEnd(roomId, currentRoom, timedOutColor);
            }
        );

        startTimer(roomId);

        socket.nsp.to(roomId).emit("timer:sync", {
            roomId,
            timer: getSnapshot(roomId),
            timeControl: {
                type: DEFAULT_TIME_CONTROL,
                initialTimeSeconds: timeControl.initialTimeSeconds,
                incrementSeconds: timeControl.incrementSeconds,
            },
        });
    });

    socket.on("chess_move", (data, callback: GameActionCallback<{ from: Position; to: Position; promotionPiece?: PromotionPiece }>) => {
        const result = ChessMovePayloadSchema.safeParse(data);

        if (!result.success) {
            return emitGameError(callback, new Error("Invalid chess move payload"));
        }

        const { roomId, from, to, promotionPiece } = result.data;

        runGameAction({
            roomId,
            eventName: "chess_move",
            callback,
            action: ({ room, player }) => {
                if (!hasTimer(roomId)) {
                    throw new InvalidMoveException("Game has not started yet");
                }

                const piece = room.game.getPieceAt(from);
                if (!piece) throw new InvalidMoveException("No piece at source square");
                if (piece.color !== player.color) throw new InvalidMoveException("You cannot move opponent's piece");

                if (room.game.getCurrentTurn() !== player.color) {
                    throw new InvalidMoveException("It is not your turn!");
                }

                if (promotionPiece !== undefined && !PROMOTION_PIECES.includes(promotionPiece)) {
                    throw new InvalidMoveException("Invalid promotion piece");
                }

                const moved = room.game.movePiece(from, to, promotionPiece);
                if (!moved) throw new InvalidMoveException("Illegal move");

                return promotionPiece === undefined
                    ? { from, to }
                    : { from, to, promotionPiece };
            },
        });
    });

    socket.on("game:resign", async (data, callback?: GameActionCallback<{ reason: "resign" }>) => {
        const result = JoinRoomPayloadSchema.safeParse(data);

        if (!result.success) {
            return emitGameError(callback, new Error("Invalid resign payload"));
        }

        const { roomId } = result.data;

        try {
            const { room, player } = getAuthorizedRoomContext(roomId);
            const winner = player.color === "white" ? "black" : "white";

            await emitManualGameOver(
                roomId,
                room,
                winner,
                winner === "white" ? "white_wins" : "black_wins",
                "resign",
            );

            callback?.({
                ok: true,
                ...buildGameStatePayload(roomId, room),
                gameStatus: winner === "white" ? "white_wins" : "black_wins",
                reason: "resign",
                eloUpdate: room.ratedResult,
                timer: null,
            });
        } catch (err) {
            emitGameError(callback, err);
        }
    });

    socket.on("draw:offer", async (data, callback?: GameActionCallback<{ offeredBy?: string; reason?: "draw_agreement" }>) => {
        const result = JoinRoomPayloadSchema.safeParse(data);

        if (!result.success) {
            return emitGameError(callback, new Error("Invalid draw offer payload"));
        }

        try {
            const { roomId } = result.data;
            const { room, player } = getAuthorizedRoomContext(roomId);

            if (room.players.length < 2) {
                throw new Error("Cannot offer draw before both players join");
            }

            const existingOfferBy = drawOffers.get(roomId);
            if (existingOfferBy && existingOfferBy !== player.userId) {
                await emitManualGameOver(roomId, room, "draw", "draw_agreement", "draw_agreement");
                callback?.({
                    ok: true,
                    ...buildGameStatePayload(roomId, room),
                    gameStatus: "draw_agreement",
                    reason: "draw_agreement",
                    eloUpdate: room.ratedResult,
                    timer: null,
                });
                return;
            }

            drawOffers.set(roomId, player.userId);
            const payload = {
                roomId,
                offeredBy: player.userId,
                username: player.username,
            };
            socket.to(roomId).emit("draw:offer", payload);
            room.players.forEach((roomPlayer) => {
                if (roomPlayer.userId !== player.userId && roomPlayer.socketId !== "__ai__") {
                    socket.nsp.to(roomPlayer.socketId).emit("draw:offer", payload);
                }
            });
            callback?.({
                ok: true,
                ...buildGameStatePayload(roomId, room),
                offeredBy: player.userId,
            });
        } catch (err) {
            emitGameError(callback, err);
        }
    });

    socket.on("draw:accept", async (data, callback?: GameActionCallback<{ reason: "draw_agreement" }>) => {
        const result = JoinRoomPayloadSchema.safeParse(data);

        if (!result.success) {
            return emitGameError(callback, new Error("Invalid draw accept payload"));
        }

        try {
            const { roomId } = result.data;
            const { room, player } = getAuthorizedRoomContext(roomId);
            const offeredBy = drawOffers.get(roomId);

            if (!offeredBy || offeredBy === player.userId) {
                throw new Error("No opponent draw offer to accept");
            }

            await emitManualGameOver(roomId, room, "draw", "draw_agreement", "draw_agreement");
            callback?.({
                ok: true,
                ...buildGameStatePayload(roomId, room),
                gameStatus: "draw_agreement",
                reason: "draw_agreement",
                eloUpdate: room.ratedResult,
                timer: null,
            });
        } catch (err) {
            emitGameError(callback, err);
        }
    });

    socket.on("draw:decline", (data) => {
        const result = JoinRoomPayloadSchema.safeParse(data);

        if (!result.success) {
            return socket.emit("game_error", { message: "Invalid draw decline payload" });
        }

        try {
            const { roomId } = result.data;
            const { player } = getAuthorizedRoomContext(roomId);
            const offeredBy = drawOffers.get(roomId);

            if (!offeredBy || offeredBy === player.userId) {
                return;
            }

            drawOffers.delete(roomId);
            socket.to(roomId).emit("draw:declined", {
                roomId,
                declinedBy: player.userId,
                username: player.username,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown game error";
            socket.emit("game_error", { message });
        }
    });

    socket.on("timer:sync", (data) => {
        const result = TimerSyncPayloadSchema.safeParse(data);

        if (!result.success) {
            return socket.emit("game_error", { message: "Invalid timer sync payload" });
        }

        const { roomId } = result.data;
        const snapshot = getSnapshot(roomId);

        if (!snapshot) return;

        socket.emit("timer:sync", {
            roomId,
            timer: snapshot,
        });
    });
};
