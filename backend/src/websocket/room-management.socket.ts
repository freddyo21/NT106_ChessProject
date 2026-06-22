import { Socket } from "socket.io";
import { DEFAULT_ELO } from "@zess-online-chess/shared";
import { Logger } from "../utils/Logger";
import { ChessBoard } from "../entities/ChessBoard";
import { JoinRoomPayloadSchema, LeaveRoomPayloadSchema } from "@zess-online-chess/shared";
import { applyMatchEloResult } from "../services/elo.service";
import { destroyTimer } from "../services/timer.service";
import * as gameRepository from "../repositories/game.repository";
import { buildGameStatePayload, buildRoomJoinedPayload } from "../utils/game-payload";
import { updatePresenceElo } from "./presence.socket";
import * as leaderboardService from "../services/leaderboard.service";
type PlayerColor = "white" | "black";
export type AiDifficulty = "easy" | "medium" | "hard";

type RoomPlayer = {
    userId: string;
    socketId: string;
    color: PlayerColor;
    username: string;
    elo: number;
};

type GameRoom = {
    players: RoomPlayer[];
    game: ChessBoard;
    readyUserIds: Set<string>;
    aiDifficulty?: AiDifficulty;
    gameId?: string;
    ratedResult?: {
        result: "white" | "black" | "draw";
        whiteDelta: number;
        blackDelta: number;
        whiteNextElo: number;
        blackNextElo: number;
    };
};

const gameRooms: Map<string, GameRoom> = new Map<string, GameRoom>();
const userToRoom = new Map<string, string>();
const disconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const getAvailableColor = (players: RoomPlayer[]): PlayerColor | null => {
    const hasWhite = players.some((player) => player.color === "white");
    const hasBlack = players.some((player) => player.color === "black");

    if (!hasWhite) return "white";
    if (!hasBlack) return "black";
    return null;
};

const buildRoomsList = () => {
    return [...gameRooms.entries()]
        .filter(([roomId]) => !roomId.startsWith("quick-") && !roomId.startsWith("q-") && !roomId.startsWith("ai-"))
        .map(([roomId, room]) => {
        const host = room.players[0];
        const players = room.players.length;

        return {
            id: roomId,
            roomName: `Phòng của ${host?.username ?? "Unknown"}`,
            roomCode: roomId,
            hostName: host?.username ?? "Unknown",
            hostElo: host?.elo ?? DEFAULT_ELO,
            players,
            maxPlayers: 2,
            status: players >= 2 ? "playing" : "waiting",
        };
    });
};

const emitRoomsChanged = (socket: Socket) => {
    // Room list là dữ liệu realtime trong memory, dùng để frontend bỏ danh sách phòng mock.
    socket.nsp.emit("rooms:changed", buildRoomsList());
};

const emitRatingRealtimeUpdates = async (socket: Socket, userIds: string[]) => {
    const uniqueUserIds = [...new Set(userIds)];

    const statsList = await Promise.all(
        uniqueUserIds.map((userId) => leaderboardService.getPlayerProfileStats(userId))
    );

    statsList.forEach((stats) => {
        socket.nsp.to(`user:${stats.userId}`).emit("profile:stats_updated", stats);
    });
    socket.nsp.emit("leaderboard:changed");
};

const ensureRoomGameCreated = async (roomId: string, room: GameRoom, createdBy: string) => {
    if (room.gameId) {
        return room.gameId;
    }

    const whitePlayer = room.players.find((player) => player.color === "white");
    const blackPlayer = room.players.find((player) => player.color === "black");

    if (!whitePlayer || !blackPlayer) {
        throw new Error("Need two players to create a game.");
    }

    const game = await gameRepository.createGame({
        whitePlayerId: whitePlayer.userId,
        blackPlayerId: blackPlayer.userId,
        createdBy,
        roomCode: roomId,
        timeControlType: "blitz",
        initialTimeSeconds: 300,
        incrementSeconds: 0,
        whiteRatingSnapshot: whitePlayer.elo,
        blackRatingSnapshot: blackPlayer.elo,
    });

    room.gameId = game.id;
    return game.id;
};

const applyForfeitEloResult = async (socket: Socket, room: GameRoom, winner: PlayerColor) => {
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
        result: winner,
    });

    whitePlayer.elo = eloResult.whiteNextElo;
    blackPlayer.elo = eloResult.blackNextElo;
    const updatedWhitePresence = updatePresenceElo(whitePlayer.userId, eloResult.whiteNextElo);
    const updatedBlackPresence = updatePresenceElo(blackPlayer.userId, eloResult.blackNextElo);
    if (updatedWhitePresence) socket.nsp.emit("presence:user_online", updatedWhitePresence);
    if (updatedBlackPresence) socket.nsp.emit("presence:user_online", updatedBlackPresence);
    room.ratedResult = {
        result: winner,
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

        await Promise.all([
            gameRepository.updateRating({
                userId: whitePlayer.userId,
                newRating: eloResult.whiteNextElo,
                result: winner === "white" ? "win" : "loss",
            }),
            gameRepository.updateRating({
                userId: blackPlayer.userId,
                newRating: eloResult.blackNextElo,
                result: winner === "black" ? "win" : "loss",
            }),
            gameRepository.finishGame({
                gameId: room.gameId,
                result: winner === "white" ? "white_win" : "black_win",
                terminationReason: "aborted",
                winnerId: winner === "white" ? whitePlayer.userId : blackPlayer.userId,
                moveCount: room.game.getMoveCount(),
            }),
            gameRepository.insertRatingHistory(whitePlayer.userId, room.gameId, whiteRating.rating, eloResult.whiteNextElo),
            gameRepository.insertRatingHistory(blackPlayer.userId, room.gameId, blackRating.rating, eloResult.blackNextElo),
        ]);

        await emitRatingRealtimeUpdates(socket, [whitePlayer.userId, blackPlayer.userId]);
    }
};

const emitForfeitGameOver = async (
    socket: Socket,
    roomId: string,
    room: GameRoom,
    leavingPlayer: RoomPlayer,
    disconnectReason: "leave_room" | "disconnect"
) => {
    if (room.players.length < 2 || room.ratedResult) {
        return false;
    }

    const winner = leavingPlayer.color === "white" ? "black" : "white";

    destroyTimer(roomId);
    try {
        await applyForfeitEloResult(socket, room, winner);
    } catch (error) {
        const logger = new Logger("room-socket");
        logger.error("Failed to persist forfeit result", { roomId, error });
    }

    socket.nsp.to(roomId).except(socket.id).emit("game_over", {
        ...buildGameStatePayload(roomId, room),
        gameStatus: winner === "white" ? "white_wins" : "black_wins",
        reason: "opponent_left",
        leftBy: leavingPlayer.userId,
        disconnectReason,
        eloUpdate: room.ratedResult,
        timer: null,
    });

    return true;
};

export function roomManagementSocket(socket: Socket) {
    const logger = new Logger("room-socket");
    const user = socket.data.user;
    const userId = user?.id;
    const username = user?.username || "Unknown";
    const elo = typeof user?.elo === "number" ? user.elo : DEFAULT_ELO;

    if (!userId) {
        logger.error("Socket connected without user id", { socketId: socket.id });
        return;
    }

    const clearPendingDisconnect = () => {
        const existingTimeout = disconnectTimeouts.get(userId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            disconnectTimeouts.delete(userId);
        }
    };

    socket.on("join_room", (data) => {
        const result = JoinRoomPayloadSchema.safeParse(data);

        if (!result.success) {
            return socket.emit("room_error", "Invalid room payload");
        }

        const { roomId } = result.data;
        if (!roomId) {
            return socket.emit("room_error", "Room ID is required to join a room.");
        }

        if (typeof roomId !== "string") {
            return socket.emit("room_error", "Invalid Room ID");
        }

        const currentRoomId = userToRoom.get(userId);
        if (currentRoomId && currentRoomId !== roomId) {
            return socket.emit("room_error", "Leave your current room first");
        }

        clearPendingDisconnect();

        let room = gameRooms.get(roomId);

        if (!room) {
            room = {
                players: [],
                game: new ChessBoard(),
                readyUserIds: new Set<string>(),
            };
            gameRooms.set(roomId, room);
        }

        const existingPlayer = room.players.find((p) => p.userId === userId) ?? null;
        const isNewPlayer = !existingPlayer;

        if (isNewPlayer) {
            const assignedColor = getAvailableColor(room.players);
            if (!assignedColor) {
                return socket.emit("room_error", "Room is full");
            }
            room.players.push({ userId, socketId: socket.id, color: assignedColor, username, elo });
        } else {
            existingPlayer.socketId = socket.id;
            existingPlayer.username = username;
            existingPlayer.elo = elo;
        }

        socket.join(roomId);
        userToRoom.set(userId, roomId);

        socket.emit("room_joined", buildRoomJoinedPayload(roomId, room, userId));

        if (isNewPlayer) {
            socket.to(roomId).emit("player_joined", {
                userId,
                socketId: socket.id,
                color: room.players.find((player) => player.userId === userId)?.color ?? null,
                username,
                elo,
            });
        }

        emitRoomsChanged(socket);
        logger.log(`User ${socket.id} has joined room ${roomId}`);
    });

    socket.on("room:ready", (data, callback?: (response: { ok: boolean; message?: string }) => void) => {
        const roomId = typeof data?.roomId === "string" ? data.roomId.trim() : "";
        const ready = typeof data?.ready === "boolean" ? data.ready : null;

        if (!roomId || ready === null) {
            callback?.({ ok: false, message: "Invalid ready payload" });
            return;
        }

        const room = gameRooms.get(roomId);

        if (!room) {
            callback?.({ ok: false, message: "Room does not exist." });
            return socket.emit("room_error", "Room does not exist.");
        }

        if (!socket.rooms.has(roomId)) {
            callback?.({ ok: false, message: "Not in room." });
            return socket.emit("room_error", "Not in room.");
        }

        const playerIndex = room.players.findIndex((player) => player.userId === userId);
        if (playerIndex < 0) {
            callback?.({ ok: false, message: "Not in room." });
            return socket.emit("room_error", "Not in room.");
        }

        const isHost = playerIndex === 0;
        if (!isHost) {
            if (ready) {
                room.readyUserIds.add(userId);
            } else {
                room.readyUserIds.delete(userId);
            }
        }

        const payload = {
            roomId,
            userId,
            isReady: isHost || room.readyUserIds.has(userId),
        };

        socket.nsp.to(roomId).emit("player_ready_changed", payload);
        callback?.({ ok: true });
    });

    socket.on("room:start", async (data, callback?: (response: { ok: boolean; message?: string }) => void) => {
        const roomId = typeof data?.roomId === "string" ? data.roomId.trim() : "";

        if (!roomId) {
            callback?.({ ok: false, message: "Invalid start payload" });
            return;
        }

        const room = gameRooms.get(roomId);

        if (!room) {
            callback?.({ ok: false, message: "Room does not exist." });
            return socket.emit("room_error", "Room does not exist.");
        }

        if (!socket.rooms.has(roomId)) {
            callback?.({ ok: false, message: "Not in room." });
            return socket.emit("room_error", "Not in room.");
        }

        const playerIndex = room.players.findIndex((player) => player.userId === userId);
        if (playerIndex !== 0) {
            callback?.({ ok: false, message: "Only host can start the game." });
            return;
        }

        if (room.players.length < 2) {
            callback?.({ ok: false, message: "Need two players to start." });
            return;
        }

        const guestsReady = room.players
            .slice(1)
            .every((player) => room.readyUserIds.has(player.userId));

        if (!guestsReady) {
            callback?.({ ok: false, message: "Opponent is not ready." });
            return;
        }

        try {
            await ensureRoomGameCreated(roomId, room, userId);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Cannot start game.";
            logger.error("Failed to start room game", { roomId, error });
            callback?.({ ok: false, message });
            return socket.emit("room_error", message);
        }
        socket.nsp.to(roomId).emit("game_started", {
            roomId,
            roomName: `Phòng của ${room.players[0]?.username ?? "Unknown"}`,
            roomCode: roomId,
        });
        emitRoomsChanged(socket);
        callback?.({ ok: true });
    });

    socket.on("rooms:list", (callback?: (rooms: ReturnType<typeof buildRoomsList>) => void) => {
        // Cho RoomListPage chủ động lấy snapshot danh sách phòng hiện tại.
        const rooms = buildRoomsList();
        callback?.(rooms);
        socket.emit("rooms:list", rooms);
    });

    socket.on("leave_room", async (data) => {
        const result = LeaveRoomPayloadSchema.safeParse(data);

        if (!result.success) {
            return socket.emit("room_error", "Invalid room payload");
        }

        const { roomId } = result.data;
        if (!roomId) {
            return socket.emit("room_error", "Room ID is required to leave.");
        }

        const room = gameRooms.get(roomId);
        if (!room) {
            return socket.emit("room_error", "Room does not exist.");
        }

        if (!socket.rooms.has(roomId)) {
            return socket.emit("room_error", "Not in room.");
        }

        const player = room.players.find((entry) => entry.userId === userId);
        if (!player) {
            return socket.emit("room_error", "Not in room.");
        }

        const existingTimeout = disconnectTimeouts.get(userId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            disconnectTimeouts.delete(userId);
        }

        const didForfeit = await emitForfeitGameOver(socket, roomId, room, player, "leave_room");

        room.readyUserIds.delete(userId);
        room.players = room.players.filter((entry) => entry.userId !== userId);
        socket.leave(roomId);

        userToRoom.delete(userId);

        if (room.players.length === 0) {
            gameRooms.delete(roomId);
            logger.log(`Room ${roomId} deleted (empty room)`);
        } else if (!didForfeit) {
            socket.to(roomId).emit("player_left", { userId });
        }

        emitRoomsChanged(socket);
        logger.log(`User ${socket.id} has left room ${roomId}`);
    });

    socket.on("disconnect", () => {
        const roomId = userToRoom.get(userId);
        if (!roomId) return;

        const room = gameRooms.get(roomId);
        if (room) {
            const player = room.players.find((entry) => entry.userId === userId);
            if (!player || player.socketId !== socket.id) {
                return;
            }

            const existingTimeout = disconnectTimeouts.get(userId);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }

            const timeoutId = setTimeout(async () => {
                const activeRoomId = userToRoom.get(userId);
                const activeRoom = activeRoomId ? gameRooms.get(activeRoomId) : undefined;
                const activePlayer = activeRoom?.players.find((entry) => entry.userId === userId);

                if (!activeRoomId || !activeRoom || !activePlayer || activePlayer.socketId !== socket.id) {
                    disconnectTimeouts.delete(userId);
                    return;
                }

                const didForfeit = await emitForfeitGameOver(socket, activeRoomId, activeRoom, activePlayer, "disconnect");

                activeRoom.readyUserIds.delete(userId);
                activeRoom.players = activeRoom.players.filter((entry) => entry.userId !== userId);

                if (activeRoom.players.length === 0) {
                    gameRooms.delete(activeRoomId);
                } else if (!didForfeit) {
                    socket.to(activeRoomId).emit("player_left", { userId });
                }

                userToRoom.delete(userId);
                disconnectTimeouts.delete(userId);
                emitRoomsChanged(socket);
                logger.log(`User ${socket.id} disconnected from room ${roomId}`);
            }, 30000);

            disconnectTimeouts.set(userId, timeoutId);
        }
    });
}

export function getGameRoom(roomId: string): GameRoom | undefined {
    return gameRooms.get(roomId);
}

export function createAiGameRoom(
    roomId: string,
    player: {
        userId: string;
        socketId: string;
        username: string;
        elo: number;
    },
    difficulty: AiDifficulty = "medium"
) {
    const room: GameRoom = {
        players: [
            {
                userId: player.userId,
                socketId: player.socketId,
                color: "white",
                username: player.username,
                elo: player.elo,
            },
            {
                userId: "ai-bot",
                socketId: "__ai__",
                color: "black",
                username: "Zess AI",
                elo: DEFAULT_ELO,
            },
        ],
        game: new ChessBoard(),
        readyUserIds: new Set<string>([player.userId, "ai-bot"]),
        aiDifficulty: difficulty,
    };

    gameRooms.set(roomId, room);
    userToRoom.set(player.userId, roomId);

    return room;
}

export async function createMatchedGameRoom(
    roomId: string,
    players: Array<{
        userId: string;
        socketId: string;
        color: PlayerColor;
        username: string;
        elo: number;
    }>
) {
    const whitePlayer = players.find((player) => player.color === "white");
    const blackPlayer = players.find((player) => player.color === "black");
    let gameId: string | undefined;

    if (whitePlayer && blackPlayer) {
        const game = await gameRepository.createGame({
            whitePlayerId: whitePlayer.userId,
            blackPlayerId: blackPlayer.userId,
            createdBy: whitePlayer.userId,
            roomCode: roomId,
            timeControlType: "blitz",
            initialTimeSeconds: 300,
            incrementSeconds: 0,
            whiteRatingSnapshot: whitePlayer.elo,
            blackRatingSnapshot: blackPlayer.elo,
        });
        gameId = game.id;
    }

    gameRooms.set(roomId, {
        players: players.map((player) => ({ ...player })),
        game: new ChessBoard(),
        readyUserIds: new Set<string>(),
        ...(gameId ? { gameId } : {}),
    });

    for (const player of players) {
        userToRoom.set(player.userId, roomId);
    }
}
