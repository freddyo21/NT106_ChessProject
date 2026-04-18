import { Socket } from "socket.io";
import { Logger } from "../utils/Logger";
import { createSocketRateLimiter } from "../middlewares/socket.limiter";

const chatRateLimiter = createSocketRateLimiter({
    rules: {
        send_message: {
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

export const chatSocket = async (socket: Socket) => {
    socket.use(chatRateLimiter.middleware(socket));
    const logger = new Logger("chat-socket");

    socket.on("send_message", async (data) => {
        try {
            if (!data || typeof data !== "object") return;

            const { roomId, message } = data;

            const username = socket.data.user?.username || "Unknown User";

            // const filteredMessage = await chatFilter(message);

            if (!roomId || !username || !message) return;

            if (!socket.rooms.has(roomId)) return;

            logger.log(`
                CHAT_MESSAGE | Room: ${roomId} | User: ${username} | Content: ${message}
            `);

            socket.to(roomId).emit("receive_message", {
                username,
                message,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error("SEND_MESSAGE_ERROR", error);
            socket.emit("chat_error", {
                message: "Invalid message payload"
            });
        }
    });
}