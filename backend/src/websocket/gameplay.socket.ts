import { Socket } from "socket.io";
import { Position } from "../types/Position";
import { getGameRoom } from "./room-management.socket";
import { AuthorizedRoomContext, GameActionCallback, GameRoom, GameStatePayload, PromotionPiece } from "../types/Gameplay";
import { InvalidMoveException } from "../exceptions";
import { applyMatchEloResult } from "../services/elo.service";

const PROMOTION_PIECES: PromotionPiece[] = ["queen", "rook", "bishop", "knight"];

const getRatedResultFromGameStatus = (status: string): "white" | "black" | "draw" | null => {
    // Chỉ các trạng thái kết thúc ván mới được dùng để cộng/trừ Elo.
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
    const emitGameError = (callback: GameActionCallback | undefined, err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unknown";
        socket.emit("game_error", { message: msg });
        if (callback) callback({ ok: false, message: msg });
    };

    const getAuthorizedRoomContext = (roomId: string): AuthorizedRoomContext => {
        // Mọi action gameplay phải đến từ socket đã join đúng room để tránh move chéo phòng.
        if (!roomId) throw new Error("Missing roomId");
        if (!socket.rooms.has(roomId)) throw new Error("You are not in this room");

        const room = getGameRoom(roomId);
        if (!room) throw new Error("Room not found");

        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player) throw new Error("Player not found in room");

        return { room, player };
    };

    const buildGameStatePayload = (roomId: string, room: GameRoom): GameStatePayload => ({
        // Payload này là nguồn đồng bộ board/turn/status cho cả hai client trong cùng phòng.
        roomId,
        currentTurn: room.game.getCurrentTurn(),
        board: room.game.getBoard(),
        kingPositions: {
            white: room.game.getKingPosition("white"),
            black: room.game.getKingPosition("black"),
        },
        gameStatus: room.game.getGameStatus(),
    });

    const applyRatedResultIfNeeded = async (room: GameRoom) => {
        const result = getRatedResultFromGameStatus(room.game.getGameStatus());

        // ratedResult đảm bảo một ván chỉ apply Elo đúng một lần, kể cả client emit lại sau khi kết thúc.
        if (!result || room.ratedResult) {
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

        // Cập nhật Elo in-memory để room list/board sau đó thấy Elo mới ngay, không cần reconnect.
        whitePlayer.elo = eloResult.whiteNextElo;
        blackPlayer.elo = eloResult.blackNextElo;
        room.ratedResult = {
            result,
            whiteDelta: eloResult.whiteDelta,
            blackDelta: eloResult.blackDelta,
            whiteNextElo: eloResult.whiteNextElo,
            blackNextElo: eloResult.blackNextElo,
        };
    };

    const runGameAction = async <T extends object = {}>({
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
            // Sau mỗi action hợp lệ, kiểm tra xem nước đi đó có kết thúc ván và cần tính Elo không.
            await applyRatedResultIfNeeded(context.room);
            const payload: GameStatePayload & T = {
                ...buildGameStatePayload(roomId, context.room),
                // eloUpdate chỉ xuất hiện khi ván đã chốt Elo, frontend dùng để cập nhật badge và thông báo.
                eloUpdate: context.room.ratedResult,
                ...extraPayload,
            };

            socket.nsp.to(roomId).emit(eventName, payload);
            callback?.({ ok: true, ...payload });
        } catch (err) {
            emitGameError(callback, err);
        }
    };

    socket.on("chess_move", (data, callback: GameActionCallback<{ from: Position; to: Position; promotionPiece?: PromotionPiece }>) => {
        const { roomId, from, to, promotionPiece } = data ?? {};

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

                if (
                    promotionPiece !== undefined &&
                    !PROMOTION_PIECES.includes(promotionPiece)
                ) {
                    throw new InvalidMoveException("Invalid promotion piece");
                }

                const moved = room.game.movePiece(from, to, promotionPiece);
                if (!moved) throw new InvalidMoveException("Illegal move");

                return { from, to, promotionPiece };
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
};
