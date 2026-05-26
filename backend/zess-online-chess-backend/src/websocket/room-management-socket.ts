import { Socket } from "socket.io";

export function roomManagementSocket(socket: Socket) {
    socket.on("join_room", (roomId: string) => {
        socket.join(roomId);
        console.log(`User ${socket.id} has joined room ${roomId}`);
    });

    socket.on("leave_room", (roomId: string) => {
        socket.leave(roomId);
        console.log(`User ${socket.id} has left room ${roomId}`);
    });
}