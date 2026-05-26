import { Socket } from "socket.io";
import { ChessMovePayloadSchema, GameReadyPayloadSchema, TimerSyncPayloadSchema } from "@zess-online-chess/shared";
import { Position } from "../types/Position";
import { getGameRoom } from "./room-management.socket";
import {
    AuthorizedRoomContext,
    GameActionCallback,
    GameRoom,
    GameStatePayload,
    PromotionPiece,
} from "../types/Gameplay";
import { InvalidMoveException } from "../exceptions";
import {
    createTimer,
    destroyTimer,
    getSnapshot,
    startTimer,
    switchTurn,
    TIME_CONTROLS,
    TimeControlType,
} from "../services/timer.service";

const DEFAULT_TIME_CONTROL: TimeControlType = "blitz";
const roomToGameId = new Map<string, string>();

const getGameResultFromStatus = (status: string): "white" | "black" | "draw" | null => {
    if (status === "white_wins") return "white";
    if (status === "black_wins") return "black";
    if (
        status === "stalemate" ||
        status === "draw_insufficient_material" ||
        status === "draw_fifty_move_rule"
    ) return "draw";

    return null;
};

export const gameplaySocket = (socket: Socket) => {
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

        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player) throw new Error("Player not found in room");

        return { room, player };
    };

    const buildGameStatePayload = (roomId: string, room: GameRoom): GameStatePayload => ({
        roomId,
        currentTurn: room.game.getCurrentTurn(),
        board: room.game.getBoard(),
        kingPositions: {
            white: room.game.getKingPosition("white"),
            black: room.game.getKingPosition("black"),
        },
        gameStatus: room.game.getGameStatus(),
    });

    const handleGameEnd = (roomId: string, room: GameRoom, timedOutColor?: "white" | "black") => {
        destroyTimer(roomId);
        roomToGameId.delete(roomId);

        if (timedOutColor) {
            socket.nsp.to(roomId).emit("game_timeout", {
                loser: timedOutColor,
                winner: timedOutColor === "white" ? "black" : "white",
            });
        }

        socket.nsp.to(roomId).emit("game_over", {
            ...buildGameStatePayload(roomId, room),
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

            const gameStatus = context.room.game.getGameStatus();
            const isGameOver = getGameResultFromStatus(gameStatus) !== null;

            const timerSnapshot = isGameOver ? null : await switchTurn(roomId);

            if (isGameOver) {
                handleGameEnd(roomId, context.room);
            }

            const payload = {
                ...buildGameStatePayload(roomId, context.room),
                timer: isGameOver ? null : timerSnapshot,
                ...extraPayload,
            };

            socket.nsp.to(roomId).emit(eventName, payload);
            callback?.({ ok: true, ...payload });
        } catch (err) {
            emitGameError(callback, err);
        }
    };

    socket.on("game:ready", (data) => {
        const result = GameReadyPayloadSchema.safeParse(data);

        if (!result.success) {
            return socket.emit("game_error", { message: "Invalid game ready payload" });
        }

        const { roomId, gameId } = result.data;
        const room = getGameRoom(roomId);

        if (!room || room.players.length < 2) return;
        if (getSnapshot(roomId)) return;

        if (gameId) {
            roomToGameId.set(roomId, gameId);
        }

        const timeControl = TIME_CONTROLS[DEFAULT_TIME_CONTROL];

        createTimer(
            roomId,
            gameId ?? roomId,
            timeControl,
            (timedOutColor) => {
                const currentRoom = getGameRoom(roomId);
                if (!currentRoom) return;

                handleGameEnd(roomId, currentRoom, timedOutColor);
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
                const piece = room.game.getPieceAt(from);
                if (!piece) throw new InvalidMoveException("No piece at source square");
                if (piece.color !== player.color) throw new InvalidMoveException("You cannot move opponent's piece");

                if (room.game.getCurrentTurn() !== player.color) {
                    throw new InvalidMoveException("It is not your turn!");
                }

                const moved = room.game.movePiece(from, to, promotionPiece);
                if (!moved) throw new InvalidMoveException("Illegal move");

                return promotionPiece === undefined
                    ? { from, to }
                    : { from, to, promotionPiece };
            },
        });
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