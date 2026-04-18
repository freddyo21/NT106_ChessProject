import { Socket } from "socket.io";
import { Position } from "../types/Position";
import { getGameRoom } from "./room-management.socket";
import { AuthorizedRoomContext, GameActionCallback, GameRoom, GameStatePayload } from "../types/Gameplay";
import { InvalidMoveException } from "../exceptions";

export const gameplaySocket = (socket: Socket) => {
    const emitGameError = (callback: GameActionCallback | undefined, err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unknown";
        socket.emit("game_error", { message: msg });
        if (callback) callback({ ok: false, message: msg });
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
    });

    const runGameAction = <T extends object = {}>({
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
            const payload: GameStatePayload & T = {
                ...buildGameStatePayload(roomId, context.room),
                ...extraPayload,
            };

            socket.nsp.to(roomId).emit(eventName, payload);
            callback?.({ ok: true, ...payload });
        } catch (err) {
            emitGameError(callback, err);
        }
    };

    socket.on("chess_move", (data, callback: GameActionCallback<{ from: Position; to: Position }>) => {
        const { roomId, from, to } = data ?? {};

        runGameAction({
            roomId,
            eventName: "chess_move",
            callback,
            action: ({ room, player }) => {
                if (!from || !to) throw new Error("Missing roomId/from/to");

                const piece = room.game.getPieceAt(from);
                if (!piece) throw new InvalidMoveException("No piece at source square");
                if (piece.color !== player.color) throw new InvalidMoveException("You cannot move opponent's piece");

                if (room.game.getCurrentTurn() !== player.color) {
                    throw new InvalidMoveException("It is not your turn!");
                }

                const moved = room.game.movePiece(from, to);
                if (!moved) throw new InvalidMoveException("Illegal move");

                return { from, to };
            },
        });
    });

    // Chỉ được undo khi đấu với máy. Nếu không phát triển tính năng đấu với máy thì tính năng này sẽ được comment lại
    // socket.on("undo_move", ({ roomId }, callback: GameActionCallback<{}>) => {
    //     runGameAction({
    //         roomId,
    //         eventName: "undo_move",
    //         callback,
    //         action: ({ room }) => {
    //             const undone = room.game.undoMove();
    //             if (!undone) throw new Error("No move to undo");
    //         },
    //     });
    // });
}
