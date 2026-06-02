import { Socket } from "socket.io";
import { DEFAULT_ELO } from "@zess-online-chess/shared";
import { Logger } from "../utils/Logger";
import { createMatchedGameRoom } from "./room-management.socket";

type WaitingPlayer = {
    userId: string;
    username: string;
    elo: number;
    socket: Socket;
    joinedAt: number;
};

type QuickMatchCallbackPayload =
    | { ok: true; status: "queued"; queuedAt: number }
    | { ok: true; status: "matched"; roomId: string }
    | { ok: false; message: string };

const waitingPlayers = new Map<string, WaitingPlayer>();
const logger = new Logger("matchmaking-socket");

const createRoomId = () => {
    const timestamp = Date.now().toString(36);
    const suffix = Math.random().toString(36).slice(2, 8);
    return `q-${timestamp}-${suffix}`;
};

const buildOpponentPayload = (player: WaitingPlayer) => ({
    userId: player.userId,
    username: player.username,
    elo: player.elo,
});

const removeWaitingPlayer = (userId: string) => {
    waitingPlayers.delete(userId);
};

export function matchmakingSocket(socket: Socket) {
    const user = socket.data.user;
    const userId = user?.id;
    const username = user?.username || "Nguoi choi";
    const elo = typeof user?.elo === "number" ? user.elo : DEFAULT_ELO;

    if (!userId) {
        logger.error("Socket connected without user id", { socketId: socket.id });
        return;
    }

    socket.on("quick_match:join", async (callback?: (payload: QuickMatchCallbackPayload) => void) => {
        removeWaitingPlayer(userId);

        const opponent = [...waitingPlayers.values()].find((entry) => entry.userId !== userId);

        if (!opponent) {
            waitingPlayers.set(userId, {
                userId,
                username,
                elo,
                socket,
                joinedAt: Date.now(),
            });

            callback?.({ ok: true, status: "queued", queuedAt: Date.now() });
            socket.emit("quick_match:queued", { queuedAt: Date.now() });
            logger.log("Player queued for quick match", { userId, socketId: socket.id });
            return;
        }

        removeWaitingPlayer(opponent.userId);

        const roomId = createRoomId();
        const currentPlayer: WaitingPlayer = {
            userId,
            username,
            elo,
            socket,
            joinedAt: Date.now(),
        };

        try {
            await createMatchedGameRoom(roomId, [
                {
                    userId: opponent.userId,
                    socketId: opponent.socket.id,
                    color: "white",
                    username: opponent.username,
                    elo: opponent.elo,
                },
                {
                    userId: currentPlayer.userId,
                    socketId: currentPlayer.socket.id,
                    color: "black",
                    username: currentPlayer.username,
                    elo: currentPlayer.elo,
                },
            ]);
        } catch (error) {
            waitingPlayers.set(opponent.userId, opponent);
            callback?.({ ok: false, message: "Không thể tạo phòng đấu." });
            logger.error("Quick match room creation failed", { roomId, error });
            return;
        }

        opponent.socket.join(roomId);
        socket.join(roomId);

        opponent.socket.emit("quick_match:matched", {
            roomId,
            color: "white",
            opponent: buildOpponentPayload(currentPlayer),
        });

        socket.emit("quick_match:matched", {
            roomId,
            color: "black",
            opponent: buildOpponentPayload(opponent),
        });

        callback?.({ ok: true, status: "matched", roomId });
        logger.log("Quick match paired", {
            roomId,
            whiteUserId: opponent.userId,
            blackUserId: userId,
        });
    });

    socket.on("quick_match:cancel", () => {
        removeWaitingPlayer(userId);
        socket.emit("quick_match:cancelled");
        logger.log("Player cancelled quick match", { userId, socketId: socket.id });
    });

    socket.on("disconnect", () => {
        removeWaitingPlayer(userId);
    });
}
