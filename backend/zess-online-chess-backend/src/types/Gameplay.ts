import { getGameRoom } from "../../websocket/room-management-socket";

export type GameRoom = NonNullable<ReturnType<typeof getGameRoom>>;
export type RoomPlayer = GameRoom["players"][number];

// The following types are used to standardize the payloads and callbacks for game actions.
export type GameStatePayload = {
    roomId: string;
    currentTurn: ReturnType<GameRoom["game"]["getCurrentTurn"]>;
    board: ReturnType<GameRoom["game"]["getBoard"]>;
    kingPositions: {
        white: ReturnType<GameRoom["game"]["getKingPosition"]>;
        black: ReturnType<GameRoom["game"]["getKingPosition"]>;
    };
};

// This type is used for the callback response of game actions like "chess_move" and "undo_move". 
// It includes a success flag, the current game state, and optionally extra data specific to the action. 
export type GameActionSuccess<T extends object = {}> = { ok: true } & GameStatePayload & T;

// The failure type includes an error message. 
export type GameActionFailure = { ok: false; message: string };

// The callback type is a function that takes either a success or failure response.
export type GameActionCallback<T extends object = {}> = (response: GameActionSuccess<T> | GameActionFailure) => void;

export type AuthorizedRoomContext = {
    room: GameRoom;
    player: RoomPlayer;
};