import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { roomManagementSocket } from "./room-management-socket";
import { gameplaySocket } from "./gameplay-socket";
import { Logger } from "../utils/Logger";

export function socketInitialize(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_CORS_ALLOWED || "http://localhost:1420",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket: Socket) => {
        Logger.log("A user connected", socket.id);

        socket.onAny((eventName, ...args) => {
            if (process.env.NODE_ENV !== "production") {
                Logger.debug(`Incoming Event: ${eventName}`, ...args);
            }
        });

        gameplaySocket(socket);
        roomManagementSocket(socket);

        socket.on("disconnect", () => {
            Logger.log("A user disconnected", socket.id);
        });
    });

    return io;
}
