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

export function chatSocket(socket: Socket) {
    socket.use(chatRateLimiter.middleware(socket));

    socket.on("send_message", (data) => {
        const { roomId, message, username } = data;

        // Task: [ATTT] Filter sensitive content or prevent spam
        if (message.length > 200) {
            return socket.emit("chat_error", "Message is too long!");
        }

        // Log chat history to activity file by date
        Logger.log("CHAT_MESSAGE | Room: " + roomId + " | User: " + username + " | Content: " + message);

        // Broadcast message to users in the room
        socket.to(roomId).emit("receive_message", {
            username,
            message,
            timestamp: new Date().toISOString()
        });
    });
}