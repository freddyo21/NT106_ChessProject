import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./authSession";

type ServerToClientEvents = {
  "connect": () => void;
  "connect_error": (error: Error) => void;
  "disconnect": (reason: string) => void;
  "presence:list": (payload: PresenceUser[]) => void;
  "presence:user_online": (payload: PresenceUser) => void;
  "presence:user_offline": (payload: { userId: string; timestamp: string }) => void;
  "lobby:joined": (payload: { roomId: string }) => void;
  "lobby:message": (payload: LobbyMessagePayload) => void;
  "receive_message": (payload: RoomMessagePayload) => void;
  "rooms:list": (payload: SocketRoomListItem[]) => void;
  "rooms:changed": (payload: SocketRoomListItem[]) => void;
  "room_joined": (payload: {
    roomId: string;
    color: "white" | "black" | null;
    currentTurn: "white" | "black";
    board: SocketBoard;
    kingPositions: unknown;
  }) => void;
  "room_error": (message: string) => void;
  "chess_move": (payload: SocketGameStatePayload) => void;
  "game_error": (payload: { message: string }) => void;
  "quick_match:queued": (payload: { queuedAt: number }) => void;
  "quick_match:matched": (payload: QuickMatchMatchedPayload) => void;
  "quick_match:cancelled": () => void;
};

type ClientToServerEvents = {
  "presence:list": (callback?: (users: PresenceUser[]) => void) => void;
  "lobby:join": () => void;
  "lobby:send_message": (
    payload: { message: string; clientId?: string },
    callback?: (response: { ok: boolean; message?: string }) => void
  ) => void;
  "rooms:list": (callback?: (rooms: SocketRoomListItem[]) => void) => void;
  "send_message": (payload: { roomId: string; message: string }) => void;
  "join_room": (payload: {
    roomId: string;
    preferredColor?: "white" | "black";
  }) => void;
  "chess_move": (
    payload: {
      roomId: string;
      from: { row: number; col: number };
      to: { row: number; col: number };
      promotionPiece?: "queen" | "rook" | "bishop" | "knight";
    },
    callback?: (response: { ok: boolean; message?: string }) => void
  ) => void;
  "quick_match:join": (
    callback?: (payload: QuickMatchJoinResponse) => void
  ) => void;
  "quick_match:cancel": () => void;
};

export type QuickMatchJoinResponse =
  | { ok: true; status: "queued"; queuedAt: number }
  | { ok: true; status: "matched"; roomId: string }
  | { ok: false; message: string };

export type QuickMatchMatchedPayload = {
  roomId: string;
  color: "white" | "black";
  opponent: {
    userId: string;
    username: string;
    elo: number;
  };
};

export type SocketPiece = {
  type: "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";
  color: "white" | "black";
};

export type SocketBoard = (SocketPiece | null)[][];

export type SocketGameStatePayload = {
  roomId: string;
  currentTurn: "white" | "black";
  board: SocketBoard;
  kingPositions: unknown;
  gameStatus?: string;
  eloUpdate?: {
    result: "white" | "black" | "draw";
    whiteDelta: number;
    blackDelta: number;
    whiteNextElo: number;
    blackNextElo: number;
  };
  from?: { row: number; col: number };
  to?: { row: number; col: number };
  promotionPiece?: "queen" | "rook" | "bishop" | "knight";
};

export type PresenceUser = {
  userId: string;
  username: string;
  displayName: string;
  elo: number;
  status: "online" | "playing" | "idle";
};

export type LobbyMessagePayload = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  userId?: string;
};

export type RoomMessagePayload = {
  id?: string;
  userId?: string;
  username: string;
  message: string;
  timestamp: string;
};

export type SocketRoomListItem = {
  id: string;
  roomName: string;
  roomCode: string;
  hostName: string;
  hostElo: number;
  players: number;
  maxPlayers: number;
  status: "waiting" | "playing" | "full";
};

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function getSocketUrl() {
  const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL;

  if (explicitSocketUrl) {
    return explicitSocketUrl.replace(/\/+$/, "");
  }

  const apiUrl =
    import.meta.env.VITE_SERVER_API_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:3000/api/v1";

  try {
    // Socket.IO lives at the backend origin, not under the REST /api/v1 path.
    return new URL(apiUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
}

const SOCKET_URL = getSocketUrl();

let socketInstance: AppSocket | null = null;

export function getSocketToken() {
  return getAccessToken();
}

export function getAppSocket() {
  const token = getSocketToken();

  if (!token) {
    return null;
  }

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token },
      transports: ["websocket", "polling"],
    });
  }

  socketInstance.auth = { token };

  return socketInstance;
}

export function disconnectAppSocket() {
  socketInstance?.disconnect();
  socketInstance = null;
}
