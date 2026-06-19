import { getGameRoom } from "../websocket/room-management.socket";
import type { TimerSnapshot } from "./Timer";

export type GameRoom = NonNullable<ReturnType<typeof getGameRoom>>;
export type RoomPlayer = GameRoom["players"][number];
export type PromotionPiece = "queen" | "rook" | "bishop" | "knight";

export type GameStatePayload = {
    roomId: string;
    currentTurn: ReturnType<GameRoom["game"]["getCurrentTurn"]>;
    board: ReturnType<GameRoom["game"]["getBoard"]>;
    kingPositions: {
        white: ReturnType<GameRoom["game"]["getKingPosition"]>;
        black: ReturnType<GameRoom["game"]["getKingPosition"]>;
    };
    gameStatus: ReturnType<GameRoom["game"]["getGameStatus"]>;
//     eloUpdate?: GameRoom["ratedResult"];
    timer?: TimerSnapshot | null;
};

export type GameActionSuccess<T extends object = Record<string, never>> =
    { ok: true } & GameStatePayload & T;

export type GameActionFailure = {
    ok: false;
    message: string;
};

export type GameActionCallback<T extends object = Record<string, never>> = (
    response: GameActionSuccess<T> | GameActionFailure
) => void;

export type AuthorizedRoomContext = {
    room: GameRoom;
    player: RoomPlayer;
};
