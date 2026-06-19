import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_ELO, ERoles } from "@zess-online-chess/shared";
import ChatUI, { type ChatMessage } from "../ChatUI/ChatUI";
import logoImage from "../Image/ZessOnlChessLogoDon.svg";
import { getCurrentUser, getUserDisplayName, type AuthSessionUser } from "../services/authSession";
import { getAppSocket, type SocketGameStartedPayload, type SocketRoomPlayer } from "../services/socketClient";
import "./RoomPage.css";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PlayerSlot = {
  id: string;
  username: string;
  displayName: string;
  isHost: boolean;
  isReady: boolean;
  online: boolean;
  rating: number;
  color: "white" | "black" | null;
};

type RoomData = {
  id: string;
  name: string;
  code: string;
  status: "waiting" | "ready_to_start" | "playing";
  players: PlayerSlot[];
  maxPlayers: number;
};

type RoomSettings = {
  roomName: string;
  hostColor: "white" | "black" | "random";
  timeControl: 1 | 3 | 5 | "custom";
  customMinutes: number;
  bonusSeconds: number;
};

type RoomRouteState = {
  source: "create" | "join" | "quick-join";
  roomId?: string;
  roomName: string;
  roomCode: string;
  isPrivate?: boolean;
  hostName: string;
  hostElo?: number;
};

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CURRENT_USER_ID  = "current-user";

const TIME_PRESETS: { label: string; value: 1 | 3 | 5 | "custom" }[] = [
  { label: "1 phút", value: 1 },
  { label: "3 phút", value: 3 },
  { label: "5 phút", value: 5 },
  { label: "Tùy chọn", value: "custom" },
];

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "sys-01",
    sender: "System",
    text: "Phòng đã sẵn sàng. Chia sẻ mã phòng để mời đối thủ!",
    timestamp: new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isOwn: false,
  },
];

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getAuthenticatedUser(): AuthSessionUser {
  // Room waiting UI uses the authenticated session; this fallback only prevents a blank crash during redirect.
  return getCurrentUser() ?? {
    id: CURRENT_USER_ID,
    email: "",
    name: "Người chơi",
    username: "player",
    elo: DEFAULT_ELO,
    role: ERoles.GUEST,
    status: "active",
    isVerified: false,
  };
}

function buildInitialRoom(
  routeState: RoomRouteState | null,
  currentUser: AuthSessionUser
): RoomData {
  //{Sinh dá»¯ liá»‡u phĂ²ng ban Ä‘áº§u dá»±a trĂªn route state}
  const roomName = routeState?.roomName ?? "Phòng đấu nhanh";
  const roomCode = routeState?.roomCode ?? "AB12CD";
  const roomId   = routeState?.roomId   ?? "room-001";
  const username = currentUser.username  ?? "admin";
  const displayName = getUserDisplayName(currentUser);
  const currentUserId = currentUser.id || CURRENT_USER_ID;

  if (!routeState || routeState.source === "create") {
    return {
      id: roomId, name: roomName, code: roomCode,
      status: "waiting", maxPlayers: 2,
      players: [{
        id: currentUserId, username, displayName,
        isHost: true, isReady: false, online: true,
        rating: currentUser.elo ?? DEFAULT_ELO, color: "white",
      }],
    };
  }

  return {
    id: roomId, name: roomName, code: roomCode,
    status: "waiting", maxPlayers: 2,
    players: [
      {
        id: "host-user",
        username: routeState.hostName ?? "Host",
        displayName: routeState.hostName ?? "Host",
        isHost: true, isReady: true, online: true,
        rating: routeState.hostElo ?? DEFAULT_ELO, color: "white",
      },
      {
        id: currentUserId, username, displayName,
        isHost: false, isReady: false, online: true,
        rating: currentUser.elo ?? DEFAULT_ELO, color: "black",
      },
    ],
  };
}

function mapSocketPlayers(players: SocketRoomPlayer[], currentUser: AuthSessionUser): PlayerSlot[] {
  return players.map((player, index) => ({
    id: player.userId,
    username: player.username,
    displayName: player.userId === currentUser.id ? getUserDisplayName(currentUser) : player.username,
    isHost: player.isHost ?? index === 0,
    isReady: player.isHost || index === 0 || Boolean(player.isReady),
    online: true,
    rating: player.elo ?? DEFAULT_ELO,
    color: player.color,
  }));
}

// â”€â”€ EloRank badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EloLabel({ rating }: { rating: number }) {
  return <span className="rp-elo-tag">Elo {rating}</span>;
}

// â”€â”€ PlayerCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PlayerCard({ player, slot }: { player: PlayerSlot | null; slot: 1 | 2 }) {
  if (!player) {
    return (
      <div className="rp-player-card rp-player-card--empty">
        <div className="rp-player-avatar rp-player-avatar--empty">
          {slot === 1 ? "♔" : "♚"}
        </div>
        <p className="rp-player-empty-text">Chờ người chơi...</p>
      </div>
    );
  }

  return (
    <div className="rp-player-card rp-player-card--filled">
      <div
        className={`rp-player-avatar rp-player-avatar--${
          player.id === CURRENT_USER_ID ? "self" : "other"
        }`}
      >
        {player.username.slice(0, 2).toUpperCase()}
        {player.isHost && (
          <span className="rp-host-crown" title="Chủ phòng">
            ♛
          </span>
        )}
      </div>

      <div className="rp-player-info">
        <p className="rp-player-name">{player.displayName}</p>
        <EloLabel rating={player.rating} />
        {player.color && (
          <span className={`rp-color-badge rp-color-badge--${player.color}`}>
            {player.color === "white" ? "♔ Trắng" : "♚ Đen"}
          </span>
        )}
      </div>

      <div
        className={`rp-ready-badge ${
          player.isHost
            ? "rp-ready-badge--host"
            : player.isReady
            ? "rp-ready-badge--ready"
            : "rp-ready-badge--not-ready"
        }`}
      >
        {player.isHost
          ? "HOST"
          : player.isReady
          ? "✓ Sẵn sàng"
          : "Chưa sẵn sàng"}
      </div>
    </div>
  );
}

// â”€â”€ Settings Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SettingsPanel({
  settings,
  isHost,
  onChange,
}: {
  settings: RoomSettings;
  isHost: boolean;
  onChange: <K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput  ] = useState(settings.roomName);
  const nameRef = useRef<HTMLInputElement>(null);

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) onChange("roomName", trimmed);
    setEditingName(false);
  };

  const startEdit = () => {
    setNameInput(settings.roomName);
    setEditingName(true);
    setTimeout(() => nameRef.current?.focus(), 40);
  };

  return (
    <div className="rp-settings">
      <h3 className="rp-settings-title">⚙ Tùy chỉnh phòng đấu</h3>

      {/* Tên phòng */}
      <div className="rp-settings-group">
        <label className="rp-settings-label">Tên phòng</label>

        {isHost && editingName ? (
          <div className="rp-name-edit-row">
            <input
              ref={nameRef}
              className="rp-name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
            <button
              type="button"
              className="rp-icon-btn rp-icon-btn--confirm"
              onClick={saveName}
              title="Lưu"
            >
              ✓
            </button>
            <button
              type="button"
              className="rp-icon-btn rp-icon-btn--cancel"
              onClick={() => setEditingName(false)}
              title="Hủy"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="rp-name-display-row">
            <span className="rp-settings-value">{settings.roomName}</span>
            {isHost && (
              <button type="button" className="rp-edit-btn" onClick={startEdit}>
                ✎ Đổi tên
              </button>
            )}
          </div>
        )}
      </div>

      {/* Màu quân */}
      <div className="rp-settings-group">
        <label className="rp-settings-label">Màu quân của Host</label>
        <div className="rp-color-picker">
          {(["white", "black", "random"] as const).map((c) => (
            <button
              key={c}
              type="button"
              disabled={!isHost}
              onClick={() => onChange("hostColor", c)}
              className={[
                "rp-color-btn",
                settings.hostColor === c ? "rp-color-btn--active" : "",
                !isHost ? "rp-color-btn--disabled" : "",
              ].join(" ")}
            >
              {c === "white" ? "♔ Trắng" : c === "black" ? "♚ Đen" : "🔀 Random"}
            </button>
          ))}
        </div>
      </div>

      {/* Thời gian */}
      <div className="rp-settings-group">
        <label className="rp-settings-label">Thời gian ván đấu</label>
        <div className="rp-time-presets">
          {TIME_PRESETS.map((p) => (
            <button
              key={String(p.value)}
              type="button"
              disabled={!isHost}
              onClick={() => onChange("timeControl", p.value)}
              className={[
                "rp-time-btn",
                settings.timeControl === p.value ? "rp-time-btn--active" : "",
                !isHost ? "rp-time-btn--disabled" : "",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>

        {settings.timeControl === "custom" && (
          <div className="rp-custom-time-row">
            <label className="rp-settings-label-sm">Số phút:</label>
            <input
              type="number"
              min={1}
              max={120}
              disabled={!isHost}
              className="rp-time-input"
              value={settings.customMinutes}
              onChange={(e) => onChange("customMinutes", Number(e.target.value))}
            />
            <span className="rp-settings-label-sm">phút</span>
          </div>
        )}
      </div>

      {/* Bonus seconds */}
      <div className="rp-settings-group">
        <label className="rp-settings-label">
          Cộng thêm mỗi nước
          <span className="rp-bonus-value">&nbsp;{settings.bonusSeconds}s</span>
        </label>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          disabled={!isHost}
          className="rp-bonus-slider"
          value={settings.bonusSeconds}
          onChange={(e) => onChange("bonusSeconds", Number(e.target.value))}
        />
        <div className="rp-bonus-ticks">
          <span>0s</span>
          <span>10s</span>
          <span>20s</span>
          <span>30s</span>
        </div>
      </div>

      {!isHost && (
        <p className="rp-host-only-note">
          ⚠ Chỉ chủ phòng mới có thể thay đổi cài đặt
        </p>
      )}
    </div>
  );
}

// â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RoomPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = (location.state as RoomRouteState | null) ?? null;

  const hasAuthSession = useMemo(() => Boolean(getCurrentUser()), []);
  const currentUser = useMemo(() => getAuthenticatedUser(), []);

  useEffect(() => {
    if (!hasAuthSession) {
      navigate("/login", { replace: true });
    }
  }, [hasAuthSession, navigate]);

  const [room, setRoom] = useState<RoomData>(() =>
    buildInitialRoom(routeState, currentUser)
  );

  const [settings, setSettings] = useState<RoomSettings>({
    roomName:      room.name,
    hostColor:     "white",
    timeControl:   3,
    customMinutes: 10,
    bonusSeconds:  0,
  });

  const currentPlayer = useMemo(
    () => room.players.find((p) => p.id === currentUser.id),
    [currentUser.id, room.players]
  );

  const isHost           = !!currentPlayer?.isHost;
  const playerCount      = room.players.length;
  const hasEnoughPlayers = playerCount === room.maxPlayers;
  const allGuestsReady   = room.players
    .filter((p) => !p.isHost)
    .every((p) => p.isReady);
  const canStart = isHost && hasEnoughPlayers && allGuestsReady;

  useEffect(() => {
    if (!hasAuthSession || !room.id) {
      return;
    }

    const socket = getAppSocket();
    if (!socket) {
      return;
    }

    const handleRoomJoined = (payload: { roomId: string; players?: SocketRoomPlayer[] }) => {
      if (payload.roomId !== room.id || !payload.players) {
        return;
      }

      setRoom((prev) => ({
        ...prev,
        players: mapSocketPlayers(payload.players!, currentUser),
        status: payload.players!.length >= prev.maxPlayers ? "ready_to_start" : "waiting",
      }));
    };

    const handlePlayerJoined = (payload: SocketRoomPlayer) => {
      setRoom((prev) => {
        if (prev.players.some((player) => player.id === payload.userId)) {
          return prev;
        }

        const nextPlayers = [
          ...prev.players,
          ...mapSocketPlayers([{ ...payload, isHost: false }], currentUser),
        ].slice(0, prev.maxPlayers);

        return {
          ...prev,
          players: nextPlayers,
          status: nextPlayers.length >= prev.maxPlayers ? "ready_to_start" : "waiting",
        };
      });
    };

    const handlePlayerLeft = (payload: { userId: string }) => {
      setRoom((prev) => {
        const nextPlayers = prev.players.filter((player) => player.id !== payload.userId);
        return {
          ...prev,
          players: nextPlayers,
          status: "waiting",
        };
      });
    };

    const handlePlayerReadyChanged = (payload: { roomId: string; userId: string; isReady: boolean }) => {
      if (payload.roomId !== room.id) {
        return;
      }

      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((player) =>
          player.id === payload.userId
            ? { ...player, isReady: player.isHost || payload.isReady }
            : player
        ),
      }));
    };

    const handleGameStarted = (payload: SocketGameStartedPayload) => {
      if (payload.roomId !== room.id) {
        return;
      }

      const self = room.players.find((player) => player.id === currentUser.id);
      const opponent = room.players.find((player) => player.id !== currentUser.id);

      navigate("/board", {
        state: {
          roomId: payload.roomId,
          gameId: payload.gameId,
          roomName: payload.roomName || room.name,
          roomCode: payload.roomCode || room.code,
          playerColor: self?.color ?? "white",
          playerElo: self?.rating ?? currentUser.elo ?? DEFAULT_ELO,
          opponentName: opponent?.displayName ?? "Đối thủ",
          opponentElo: opponent?.rating ?? DEFAULT_ELO,
        },
      });
    };

    const handleRoomError = (message: string) => {
      alert(message);
      navigate("/rooms", { replace: true });
    };

    socket.on("room_joined", handleRoomJoined);
    socket.on("player_joined", handlePlayerJoined);
    socket.on("player_left", handlePlayerLeft);
    socket.on("player_ready_changed", handlePlayerReadyChanged);
    socket.on("game_started", handleGameStarted);
    socket.on("room_error", handleRoomError);

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("join_room", { roomId: room.id });

    return () => {
      socket.off("room_joined", handleRoomJoined);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
      socket.off("player_ready_changed", handlePlayerReadyChanged);
      socket.off("game_started", handleGameStarted);
      socket.off("room_error", handleRoomError);
    };
  }, [currentUser, hasAuthSession, navigate, room.code, room.id, room.name, room.players]);

  // â”€â”€ Setting updater â”€â”€

  const updateSetting = <K extends keyof RoomSettings>(
    key: K,
    value: RoomSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (key === "roomName") {
      setRoom((r) => ({ ...r, name: value as string }));
    }
  };

  // â”€â”€ Handlers â”€â”€

  const handleToggleReady = () => {
    const nextReady = !currentPlayer?.isReady;
    const socket = getAppSocket();

    socket?.emit("room:ready", { roomId: room.id, ready: nextReady }, (response) => {
      if (!response.ok) {
        alert(response.message || "Không thể cập nhật trạng thái sẵn sàng.");
      }
    });
  };

  const handleStart = () => {
    if (!canStart) {
      alert("Chưa đủ điều kiện để bắt đầu trận.");
      return;
    }

    const socket = getAppSocket();
    socket?.emit("room:start", { roomId: room.id }, (response) => {
      if (!response.ok) {
        alert(response.message || "Không thể bắt đầu ván đấu.");
      }
    });
  };

  const handleLeave = () => {
    const socket = getAppSocket();
    socket?.emit("leave_room", { roomId: room.id });
    const target = routeState?.source === "quick-join" ? "/lobby" : "/rooms";
    navigate(target);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      alert("Đã copy mã phòng!");
    } catch {
      alert("Không thể copy mã phòng.");
    }
  };

  const player1 = room.players[0] ?? null;
  const player2 = room.players[1] ?? null;

  return (
    <div className="room-page">
      <div className="room-desktop">

        {/* â”€â”€ TOPBAR â”€â”€ */}
        <header className="room-topbar">
          <button
            type="button"
            className="room-logo-box"
            onClick={handleLeave}
            aria-label="Quay về"
          >
            <img src={logoImage} alt="Zess Online Chess" />
          </button>

          <div className="room-topbar-center">
            <div className="room-topbar-info-item">
              <span className="room-topbar-label">Mã phòng</span>
              <div className="room-topbar-code-row">
                <strong className="room-topbar-code">{room.code}</strong>
                <button
                  type="button"
                  className="room-copy-btn"
                  onClick={handleCopyCode}
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="room-topbar-sep" />

            <div className="room-topbar-info-item">
              <span className="room-topbar-label">Tên phòng</span>
              <span className="room-topbar-name">{room.name}</span>
            </div>

            <div className="room-topbar-sep" />

            <div className="room-topbar-info-item">
              <span className="room-topbar-label">Người chơi</span>
              <span className="room-topbar-name">
                {playerCount}/{room.maxPlayers}
              </span>
            </div>
          </div>

          <div className={`room-topbar-status ${canStart ? "room-topbar-status--ready" : ""}`}>
            <span className="room-status-dot" />
            {canStart ? "Sẵn sàng bắt đầu" : "Đang chờ người chơi"}
          </div>
        </header>

        {/* â”€â”€ BODY â”€â”€ */}
        <main className="room-body">

          {/* LEFT: players + chat */}
          <div className="room-left">

            <div className="rp-players-row">
              <PlayerCard player={player1} slot={1} />
              <div className="rp-vs-badge">VS</div>
              <PlayerCard player={player2} slot={2} />
            </div>

            <div className="room-chat-wrap">
              <ChatUI
                roomName="Room Chat"
                currentUserName={getUserDisplayName(currentUser)}
                initialMessages={INITIAL_CHAT_MESSAGES}
              />
            </div>
          </div>

          {/* RIGHT: settings + actions */}
          <div className="room-right">

            <SettingsPanel
              settings={settings}
              isHost={isHost}
              onChange={updateSetting}
            />

            <div className="rp-actions">
              {!isHost && (
                <button
                  type="button"
                  className="rp-btn rp-btn--ready"
                  onClick={handleToggleReady}
                >
                  {currentPlayer?.isReady ? "⟳ Hủy sẵn sàng" : "✓ Sẵn sàng"}
                </button>
              )}

              <button
                type="button"
                className="rp-btn rp-btn--start"
                onClick={handleStart}
                disabled={!canStart}
                title={
                  !canStart
                    ? "Cần đủ 2 người và đối thủ đã sẵn sàng"
                    : undefined
                }
              >
                ▶ Bắt đầu ván đấu
              </button>

              <button
                type="button"
                className="rp-btn rp-btn--leave"
                onClick={handleLeave}
              >
                ← Rời phòng
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

export default RoomPage;
