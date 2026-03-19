import { Socket } from "socket.io";

export function gameplaySocket(socket: Socket) {
    socket.on("chess_move", (data) => {
        const { roomId, move } = data;
        socket.to(roomId).emit("chess_move", { move });
    });
}