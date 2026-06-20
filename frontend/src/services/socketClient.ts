import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./authSession";

type ServerToClientEvents = {
  "server-info": (payload: { port?: string; hostname?: string }) => void;
  "connect": () => void;
  "connect_error": (error: Error) => void;
  "disconnect": (reason: string) => void;
  "presence:list": (payload: PresenceUser[]) => void;
  "presence:user_online": (payload: PresenceUser) => void;
  "presence:user_offline": (payload: { userId: string; timestamp: string }) => void;
  "profile:stats_updated": (payload: PlayerProfileStatsPayload) => void;
  "leaderboard:changed": () => void;
  "lobby:joined": (payload: { roomId: string }) => void;
  "lobby:message": (payload: LobbyMessagePayload) => void;
  "chat": (payload: RoomMessagePayload) => void;
  "rooms:list": (payload: SocketRoomListItem[]) => void;
  "rooms:changed": (payload: SocketRoomListItem[]) => void;
  "room_joined": (payload: {
    roomId: string;
    color: "white" | "black" | null;
    currentTurn: "white" | "black";
    board: SocketBoard;
    kingPositions: unknown;
    players?: SocketRoomPlayer[];
  }) => void;
  "room_error": (message: string) => void;
  "player_joined": (payload: SocketRoomPlayer) => void;
  "player_left": (payload: { userId: string }) => void;
  "player_ready_changed": (payload: { roomId: string; userId: string; isReady: boolean }) => void;
  "game_started": (payload: SocketGameStartedPayload) => void;
  "chess_move": (payload: SocketGameStatePayload) => void;
  "game_over": (payload: SocketGameStatePayload) => void;
  "game_timeout": (payload: { loser: "white" | "black"; winner: "white" | "black" }) => void;
  "game_error": (payload: { message: string }) => void;
  "timer:sync": (payload: TimerSyncPayload) => void;
  "draw:offer": (payload: DrawOfferPayload) => void;
  "draw:declined": (payload: DrawDeclinedPayload) => void;
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
  "chat": (payload: { roomId: string; message: string }) => void;
  "join_room": (payload: { roomId: string }) => void;
  "leave_room": (payload: { roomId: string }) => void;
  "room:ready": (
    payload: { roomId: string; ready: boolean },
    callback?: (response: { ok: boolean; message?: string }) => void
  ) => void;
  "room:start": (
    payload: { roomId: string },
    callback?: (response: { ok: boolean; message?: string }) => void
  ) => void;
  "game:ready": (payload: { roomId: string; gameId?: string }) => void;
  "timer:sync": (payload: { roomId: string }) => void;
  "chess_move": (
    payload: {
      roomId: string;
      from: { row: number; col: number };
      to: { row: number; col: number };
      promotionPiece?: "queen" | "rook" | "bishop" | "knight";
    },
    callback?: (response: { ok: boolean; message?: string }) => void
  ) => void;
  "game:resign": (
    payload: { roomId: string },
    callback?: (response: SocketActionResponse) => void
  ) => void;
  "draw:offer": (
    payload: { roomId: string },
    callback?: (response: SocketActionResponse) => void
  ) => void;
  "draw:accept": (
    payload: { roomId: string },
    callback?: (response: SocketActionResponse) => void
  ) => void;
  "draw:decline": (payload: { roomId: string }) => void;
  "ai:start": (
    payload: { difficulty: AiDifficulty },
    callback?: (response: SocketActionResponse) => void
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
  moveCount?: number;
  reason?: "resign" | "draw_agreement" | "opponent_left";
  timer?: TimerSnapshot | null;
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

export type TimerSnapshot = {
  whiteTimeLeft: number;
  blackTimeLeft: number;
  currentTurn: "white" | "black";
  updatedAt: number;
};

export type TimerSyncPayload = {
  roomId: string;
  timer: TimerSnapshot | null;
  timeControl?: {
    type: string;
    initialTimeSeconds: number;
    incrementSeconds: number;
  };
};

export type SocketActionResponse =
  | ({ ok: true } & Partial<SocketGameStatePayload>)
  | { ok: false; message?: string };

export type AiDifficulty = "easy" | "medium" | "hard";

export type DrawOfferPayload = {
  roomId: string;
  offeredBy: string;
  username: string;
};

export type DrawDeclinedPayload = {
  roomId: string;
  declinedBy: string;
  username: string;
};

export type PresenceUser = {
  userId: string;
  username: string;
  displayName: string;
  elo: number;
  status: "online" | "playing" | "idle";
};

export type PlayerProfileStatsPayload = {
  userId: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number;
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

export type SocketRoomPlayer = {
  userId: string;
  socketId: string;
  color: "white" | "black" | null;
  username: string;
  elo: number;
  isHost?: boolean;
  isReady?: boolean;
};

export type SocketGameStartedPayload = {
  roomId: string;
  gameId?: string;
  roomName: string;
  roomCode: string;
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
let socketToken: string | null = null;

export function getSocketToken() {
  return getAccessToken();
}

export function getAppSocket() {
  const token = getSocketToken();

  if (!token) {
    return null;
  }

  if (socketInstance && socketToken !== token) {
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = null;
  }

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token },
      transports: ["websocket"],
    });

    socketInstance.on("server-info", (data) => {
    console.log("Connected to backend:", data);
  });

    socketToken = token;
  }

  socketInstance.auth = { token };

  return socketInstance;
}

export function disconnectAppSocket() {
  socketInstance?.disconnect();
  socketInstance = null;
  socketToken = null;
}
