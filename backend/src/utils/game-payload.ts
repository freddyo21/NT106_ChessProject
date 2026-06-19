import type { GameRoom, GameStatePayload } from "../types/Gameplay";

const buildBoardSnapshot = (room: GameRoom): GameStatePayload["board"] =>
    room.game.getBoard().map((row) =>
        row.map((piece) =>
            piece
                ? {
                    color: piece.color,
                    type: piece.type,
                    hasMoved: piece.hasMoved,
                }
                : null
        )
    );

export const buildGameStatePayload = (roomId: string, room: GameRoom): GameStatePayload => ({
    roomId,
    currentTurn: room.game.getCurrentTurn(),
    board: buildBoardSnapshot(room),
    kingPositions: {
        white: room.game.getKingPosition("white"),
        black: room.game.getKingPosition("black"),
    },
    gameStatus: room.game.getGameStatus(),
    moveCount: room.game.getMoveCount(),
});

export const buildRoomJoinedPayload = (roomId: string, room: GameRoom, userId: string) => {
    const me = room.players.find((player) => player.userId === userId) ?? null;

    return {
        ...buildGameStatePayload(roomId, room),
        color: me?.color ?? null,
        players: room.players.map((player, index) => ({
            userId: player.userId,
            socketId: player.socketId,
            color: player.color,
            username: player.username,
            elo: player.elo,
            isHost: index === 0,
            isReady: index === 0 || room.readyUserIds.has(player.userId),
        })),
    };
};
