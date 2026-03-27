import { Socket } from "socket.io";
import { Logger } from "../utils/Logger";
import { createSocketRateLimiter } from "../middlewares/socket.limiter";
import { chatFilter } from "../services/chat.service";

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
    const logger = new Logger("chat");

    socket.on("send_message", async (data) => {
        try {
            if (!data || typeof data !== "object") return;

            const { roomId, message, username } = data;
            const filteredMessage = await chatFilter(message);

            if (!roomId || !username || !filteredMessage) return;

            if (!socket.rooms.has(roomId)) return;

            Logger.log(`
                CHAT_MESSAGE | Room: ${roomId} | User: ${username} | Content: ${filteredMessage}
            `);

            socket.to(roomId).emit("receive_message", {
                username,
                message: filteredMessage,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            Logger.error("SEND_MESSAGE_ERROR", error);
            socket.emit("chat_error", {
                message: "Invalid message payload"
            });
        }
    });
}