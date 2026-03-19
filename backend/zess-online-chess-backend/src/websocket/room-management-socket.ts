import { Socket } from "socket.io";
import { Logger } from "../utils/Logger";

export function roomManagementSocket(socket: Socket) {
    socket.on("join_room", (roomId: string) => {
        socket.join(roomId);
        Logger.log(`User ${socket.id} has joined room ${roomId}`);
    });

    socket.on("leave_room", (roomId: string) => {
        socket.leave(roomId);
        Logger.log(`User ${socket.id} has left room ${roomId}`);
    });
}