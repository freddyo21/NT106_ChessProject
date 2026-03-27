import { Socket } from "socket.io";
import { Logger } from "../utils/Logger";
import { ChessBoard } from "../entities/classes/ChessBoard";

type PlayerColor = "white" | "black";

type RoomPlayer = {
    socketId: string;
    color: PlayerColor;
};

type GameRoom = {
    players: RoomPlayer[];
    game: ChessBoard;
};

const gameRooms: Record<string, GameRoom> = {};

const getAvailableColor = (players: RoomPlayer[]): PlayerColor | null => {
    const hasWhite = players.some((player) => player.color === "white");
    const hasBlack = players.some((player) => player.color === "black");

    if (!hasWhite) return "white";
    if (!hasBlack) return "black";
    return null;
}

export function roomManagementSocket(socket: Socket) {
    const logger = new Logger("room");

    socket.on("join_room", (roomId: string) => {
        if (!roomId) {
            return socket.emit("room_error", "Room ID is required to join a room.");
        }

        let room = gameRooms[roomId];

        if (!room) {
            room = {
                players: [],
                game: new ChessBoard(),
            };
            gameRooms[roomId] = room;
        }

        const alreadyInRoom = room.players.some(
            (player) => player.socketId === socket.id
        );

        if (!alreadyInRoom) {
            const assignedColor = getAvailableColor(room.players);

            if (!assignedColor) {
                return socket.emit("room_error", "Room is full. Cannot join.");
            }

            room.players.push({
                socketId: socket.id,
                color: assignedColor,
            });
        }

        socket.join(roomId);

        const me = room.players.find((player) => player.socketId === socket.id) ?? null;

        socket.emit("room_joined", {
            roomId,
            color: me?.color ?? null,
            board: room.game.getBoard(),
            kingPositions: {
                white: room.game.getKingPosition("white"),
                black: room.game.getKingPosition("black"),
            },
        });

        if (!alreadyInRoom) {
            socket.to(roomId).emit("player_joined", {
                socketId: socket.id,
                color: me?.color ?? null,
            });
        }

        logger.log(`User ${socket.id} has joined room ${roomId}`);
    });

    socket.on("leave_room", (roomId: string) => {
        if (!roomId) {
            return socket.emit("room_error", "Room ID is required to leave.");
        }

        const room = gameRooms[roomId];
        if (!room) {
            return socket.emit("room_error", "Room does not exist.");
        }

        if (!socket.rooms.has(roomId)) {
            return socket.emit("room_error", "Not in room.");
        }

        room.players = room.players.filter((player) => player.socketId !== socket.id);
        socket.leave(roomId);

        if (room.players.length === 0) {
            delete gameRooms[roomId];
        } else {
            socket.to(roomId).emit("player_left", { socketId: socket.id });
        }

        logger.log(`User ${socket.id} has left room ${roomId}`);
    });

    socket.on("disconnect", () => {
        for (const roomId of Object.keys(gameRooms)) {
            const room = gameRooms[roomId];
            if (!room) continue;

            const wasInRoom = room.players.some((player) => player.socketId === socket.id);

            if (!wasInRoom) {
                continue;
            }

            room.players = room.players.filter((player) => player.socketId !== socket.id);

            if (room.players.length === 0) {
                delete gameRooms[roomId];
            } else {
                socket.to(roomId).emit("player_left", { socketId: socket.id });
            }

            logger.log(`User ${socket.id} disconnected from room ${roomId}`);
        }
    });
}

export function getGameRoom(roomId: string): GameRoom | undefined {
    return gameRooms[roomId];
}
