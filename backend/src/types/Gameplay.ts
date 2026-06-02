import { getGameRoom } from "../websocket/room-management.socket";
import type { TimerSnapshot } from "./Timer";
import type { Color } from "./Color";

export type GameRoom = NonNullable<ReturnType<typeof getGameRoom>>;
export type RoomPlayer = GameRoom["players"][number];
export type PromotionPiece = "queen" | "rook" | "bishop" | "knight";
export type GameStateBoard = ({
    color: Color;
    type: "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";
    hasMoved: boolean;
} | null)[][];

export type GameStatePayload = {
    roomId: string;
    currentTurn: ReturnType<GameRoom["game"]["getCurrentTurn"]>;
    board: GameStateBoard;
    kingPositions: {
        white: ReturnType<GameRoom["game"]["getKingPosition"]>;
        black: ReturnType<GameRoom["game"]["getKingPosition"]>;
    };
    gameStatus: ReturnType<GameRoom["game"]["getGameStatus"]>;
    moveCount: number;
    eloUpdate?: GameRoom["ratedResult"];
    timer?: TimerSnapshot | null;
};

export type GameActionSuccess<T extends object = object> =
    { ok: true } & Partial<GameStatePayload> & T;

export type GameActionFailure = {
    ok: false;
    message: string;
};

export type GameActionCallback<T extends object = object> = (
    response: GameActionSuccess<T> | GameActionFailure
) => void;

export type AuthorizedRoomContext = {
    room: GameRoom;
    player: RoomPlayer;
};
