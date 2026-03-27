import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { roomManagementSocket } from "./room-management.socket";
import { gameplaySocket } from "./gameplay.socket";
import { Logger } from "../utils/Logger";
import { chatSocket } from "./chat.socket";

export function socketInitialize(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_CORS_ALLOWED || "http://localhost:1420",
            methods: ["GET", "POST"]
        }
    });

    const logger = new Logger();

    io.on("connection", (socket: Socket) => {
        logger.log("An user connected", socket.id);

        socket.onAny((eventName, ...args) => {
            if (process.env.NODE_ENV !== "production") {
                logger.debug(`Incoming Event: ${eventName}`, ...args);
            }
        });

        // Store socket and user connection info
        socket.on("user:authenticate", (userId: string) => {
            socket.data.userId = userId;
            socket.data.isOnline = true;
            socket.join(`user:${userId}`);
            logger.log("User authenticated", { socketId: socket.id, userId });
        });

        gameplaySocket(socket);
        chatSocket(socket); // Should push the messages received to the database for history
        roomManagementSocket(socket);

        socket.on("disconnect", () => {
            const userId = socket.data.userId;
            socket.data.isOnline = false;
            logger.log("An user disconnected", { socketId: socket.id, userId });

            // Notify others about user going offline
            if (userId) {
                io.emit("user:offline", { userId, socketId: socket.id });
            }
        });
    });

    return io;
}
