import { Socket } from "socket.io";
import { Logger } from "../utils/Logger";

export function chatSocket(socket: Socket) {
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