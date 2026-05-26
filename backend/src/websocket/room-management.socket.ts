import { Socket } from "socket.io";
import { DEFAULT_ELO } from "@zess-online-chess/shared";
import { Logger } from "../utils/Logger";
import { ChessBoard } from "../entities/ChessBoard";
import { JoinRoomPayloadSchema, LeaveRoomPayloadSchema } from "@zess-online-chess/shared";
type PlayerColor = "white" | "black";

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
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();

const getAvailableColor = (players: RoomPlayer[]): PlayerColor | null => {
    const hasWhite = players.some((player) => player.color === "white");
    const hasBlack = players.some((player) => player.color === "black");

    if (!hasWhite) return "white";
    if (!hasBlack) return "black";
    return null;
};

const buildRoomsList = () => {
    return [...gameRooms.entries()].map(([roomId, room]) => {
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

        const me = room.players.find((player) => player.userId === userId) ?? null;

        socket.emit("room_joined", {
            roomId,
            color: me?.color ?? null,
            currentTurn: room.game.getCurrentTurn(),
            board: room.game.getBoard(),
            kingPositions: {
                white: room.game.getKingPosition("white"),
                black: room.game.getKingPosition("black"),
            },
        });

        if (isNewPlayer) {
            socket.to(roomId).emit("player_joined", {
                userId,
                socketId: socket.id,
                color: me?.color ?? null,
            });
        }

        emitRoomsChanged(socket);
        logger.log(`User ${socket.id} has joined room ${roomId}`);
    });

    socket.on("rooms:list", (callback?: (rooms: ReturnType<typeof buildRoomsList>) => void) => {
        // Cho RoomListPage chủ động lấy snapshot danh sách phòng hiện tại.
        const rooms = buildRoomsList();
        callback?.(rooms);
        socket.emit("rooms:list", rooms);
    });

    socket.on("leave_room", (data) => {
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

        room.players = room.players.filter((entry) => entry.userId !== userId);
        socket.leave(roomId);

        userToRoom.delete(userId);

        if (room.players.length === 0) {
            gameRooms.delete(roomId);
            logger.log(`Room ${roomId} deleted (empty room)`);
        } else {
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

            const timeoutId = setTimeout(() => {
                const activeRoomId = userToRoom.get(userId);
                const activeRoom = activeRoomId ? gameRooms.get(activeRoomId) : undefined;
                const activePlayer = activeRoom?.players.find((entry) => entry.userId === userId);

                if (!activeRoomId || !activeRoom || !activePlayer || activePlayer.socketId !== socket.id) {
                    disconnectTimeouts.delete(userId);
                    return;
                }

                activeRoom.players = activeRoom.players.filter((entry) => entry.userId !== userId);

                if (activeRoom.players.length === 0) {
                    gameRooms.delete(activeRoomId);
                } else {
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
