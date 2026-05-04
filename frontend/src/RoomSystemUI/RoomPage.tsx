import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatUI, { type ChatMessage } from "../ChatUI/ChatUI";
import logoImage from "../Image/ZessOnlChessLogoDon.svg";
import "./RoomPage.css";

// ── Types ──────────────────────────────────────────────────────────────────────

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

type DemoSessionUser = {
  email: string;
  displayName: string;
  username: string;
};

type RoomRouteState = {
  source: "create" | "join" | "quick-join";
  roomId?: string;
  roomName: string;
  roomCode: string;
  isPrivate?: boolean;
  hostName: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const USER_STORAGE_KEY = "zess_demo_user";
const CURRENT_USER_ID  = "current-user";

const TIME_PRESETS: { label: string; value: 1 | 3 | 5 | "custom" }[] = [
  { label: "1 phút",    value: 1        },
  { label: "3 phút",    value: 3        },
  { label: "5 phút",    value: 5        },
  { label: "Tuỳ chọn", value: "custom" },
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDemoUser(): DemoSessionUser {
  //{Đọc user demo hiện tại từ localStorage}
  const fallback: DemoSessionUser = {
    email: "admin@gmail.com",
    displayName: "Người chơi",
    username: "admin",
  };
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as DemoSessionUser;
    return parsed.displayName && parsed.username && parsed.email
      ? parsed
      : fallback;
  } catch {
    return fallback;
  }
}

function buildInitialRoom(
  routeState: RoomRouteState | null,
  currentUser: DemoSessionUser
): RoomData {
  //{Sinh dữ liệu phòng ban đầu dựa trên route state}
  const roomName = routeState?.roomName ?? "Phòng đấu nhanh";
  const roomCode = routeState?.roomCode ?? "AB12CD";
  const roomId   = routeState?.roomId   ?? "room-001";
  const username = currentUser.username  ?? "admin";
  const displayName = currentUser.displayName ?? username;

  if (!routeState || routeState.source === "create") {
    return {
      id: roomId, name: roomName, code: roomCode,
      status: "waiting", maxPlayers: 2,
      players: [{
        id: CURRENT_USER_ID, username, displayName,
        isHost: true, isReady: false, online: true,
        rating: 1420, color: "white",
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
        rating: 1510, color: "white",
      },
      {
        id: CURRENT_USER_ID, username, displayName,
        isHost: false, isReady: false, online: true,
        rating: 1420, color: "black",
      },
    ],
  };
}

// ── EloRank badge ──────────────────────────────────────────────────────────────

function EloRank({ rating }: { rating: number }) {
  const { label, cls } =
    rating >= 2000 ? { label: "Master",   cls: "master"   } :
    rating >= 1800 ? { label: "Diamond",  cls: "diamond"  } :
    rating >= 1600 ? { label: "Platinum", cls: "platinum" } :
                     { label: "Gold",     cls: "gold"     };

  return (
    <span className={`rp-elo-tag rp-elo-${cls}`}>
      {label} · {rating}
    </span>
  );
}

// ── PlayerCard ────────────────────────────────────────────────────────────────

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
        <EloRank rating={player.rating} />
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

// ── Settings Panel ─────────────────────────────────────────────────────────────

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
              title="Huỷ"
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

// ── Main Page ─────────────────────────────────────────────────────────────────

function RoomPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = (location.state as RoomRouteState | null) ?? null;

  const demoUser = useMemo(() => getDemoUser(), []);

  const [room, setRoom] = useState<RoomData>(() =>
    buildInitialRoom(routeState, demoUser)
  );

  const [settings, setSettings] = useState<RoomSettings>({
    roomName:      room.name,
    hostColor:     "white",
    timeControl:   3,
    customMinutes: 10,
    bonusSeconds:  0,
  });

  const currentPlayer = useMemo(
    () => room.players.find((p) => p.id === CURRENT_USER_ID),
    [room.players]
  );

  const isHost           = !!currentPlayer?.isHost;
  const playerCount      = room.players.length;
  const hasEnoughPlayers = playerCount === room.maxPlayers;
  const allGuestsReady   = room.players
    .filter((p) => !p.isHost)
    .every((p) => p.isReady);
  const canStart = isHost && hasEnoughPlayers && allGuestsReady;

  // ── Setting updater ──

  const updateSetting = <K extends keyof RoomSettings>(
    key: K,
    value: RoomSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (key === "roomName") {
      setRoom((r) => ({ ...r, name: value as string }));
    }
  };

  // ── Handlers ──

  const handleToggleReady = () => {
    setRoom((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === CURRENT_USER_ID ? { ...p, isReady: !p.isReady } : p
      ),
    }));
  };

  const handleStart = () => {
    if (!canStart) {
      alert("Chưa đủ điều kiện để bắt đầu trận.");
      return;
    }
    navigate("/board", {
      state: { roomId: room.id, roomName: room.name, roomCode: room.code },
    });
  };

  const handleLeave = () => {
    //{Nếu vào từ chơi nhanh thì quay về Lobby, ngược lại về danh sách phòng}
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

        {/* ── TOPBAR ── */}
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

        {/* ── BODY ── */}
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
                currentUserName={demoUser.displayName || demoUser.username}
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