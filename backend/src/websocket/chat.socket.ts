import { ChatPayloadSchema } from "@zess-online-chess/shared";
import { Socket } from "socket.io";
import { Logger } from "../utils/Logger";
import { createSocketRateLimiter } from "../middlewares/socket.limiter";

const chatRateLimiter = createSocketRateLimiter({
    rules: {
        chat: {
            windowMs: 5_000,
            max: 5,
            blockDurationMs: 15_000
        },
        typing: {
            windowMs: 3_000,
            max: 12
        },
        "*": {
            windowMs: 1_000,
            max: 25
        }
    },
    keyGenerator: (socket) =>
        String(socket.data?.user?.id ?? socket.handshake.address ?? socket.id),
    onRateLimited: (socket, eventName, details) => {
        socket.emit("chat:rate_limited", {
            event: eventName,
            retryAfterMs: details.retryAfterMs,
            message: "You are sending messages too quickly. Please wait a moment."
        });
    }
});

const LOBBY_ROOM = "lobby";

export const chatSocket = async (socket: Socket) => {
    socket.use(chatRateLimiter.middleware(socket));
    const logger = new Logger("chat-socket");
    socket.join(LOBBY_ROOM);

    socket.on("chat", async (data) => {
        try {
            const result = ChatPayloadSchema.safeParse(data);

            if (!result.success) {
                return socket.emit("chat_error", { message: "Invalid chat payload" });
            }

            const { roomId, message } = result.data;
            const userId = socket.data.user?.id;
            const username = socket.data.user?.username || "Unknown User";

            const payload = {
                roomId: roomId ?? null,
                userId,
                username,
                message,
                timestamp: new Date().toISOString(),
            };

            if (roomId) {
                if (!socket.rooms.has(roomId)) {
                    return socket.emit("chat_error", { message: "You are not in this room" });
                }

                socket.nsp.to(roomId).emit("chat", payload);
                return;
            }

            socket.nsp.to(roomId).emit("chat", {
                id: `${Date.now()}-${socket.id}`,
                userId: socket.data.user?.id,
                username,
                message,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error("CHAT_ERROR", error);
            socket.emit("chat_error", {
                message: "Invalid message payload"
            });
        }
    });
};
