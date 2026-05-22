import { Socket } from "socket.io";
import { Logger } from "../utils/Logger";

const LOBBY_ROOM_ID = "lobby";
const logger = new Logger("lobby-socket");

type LobbyMessageCallback = (response: { ok: boolean; message?: string }) => void;

export function lobbySocket(socket: Socket) {
    socket.on("lobby:join", () => {
        // Lobby dùng room socket riêng để không tạo game room trong room-management.
        socket.join(LOBBY_ROOM_ID);
        socket.emit("lobby:joined", { roomId: LOBBY_ROOM_ID });
    });

    socket.on(
        "lobby:send_message",
        (payload: { message?: string; clientId?: string }, callback?: LobbyMessageCallback) => {
            const message = payload?.message?.trim();
            const user = socket.data.user;

            if (!message) {
                callback?.({ ok: false, message: "Message is required" });
                return;
            }

            if (!socket.rooms.has(LOBBY_ROOM_ID)) {
                socket.join(LOBBY_ROOM_ID);
            }

            const chatMessage = {
                // Reuse clientId so optimistic frontend messages are replaced instead of duplicated.
                id: payload?.clientId || `${Date.now()}-${socket.id}`,
                sender: user?.username || "Unknown",
                text: message,
                timestamp: new Date().toISOString(),
                userId: user?.id,
            };

            // Emit cho cả sender để frontend hiển thị đúng theo payload từ server, không bị lệch timestamp/id.
            socket.nsp.to(LOBBY_ROOM_ID).emit("lobby:message", chatMessage);
            callback?.({ ok: true });
            logger.log("Lobby message sent", { userId: user?.id, socketId: socket.id });
        }
    );
}
