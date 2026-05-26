import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_ELO, ERoles, getEloRankLabel, getRankByElo } from "@zess-online-chess/shared";
import ChatUI, { type ChatMessage } from "../ChatUI/ChatUI";
import logoImage from "../Image/ZessOnlChessLogoDon.svg";
import { getCurrentUser, getUserDisplayName, type AuthSessionUser } from "../services/authSession";
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
  { label: "1 phĂºt",    value: 1        },
  { label: "3 phĂºt",    value: 3        },
  { label: "5 phĂºt",    value: 5        },
  { label: "Tuá»³ chá»n", value: "custom" },
];

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "sys-01",
    sender: "System",
    text: "PhĂ²ng Ä‘Ă£ sáºµn sĂ ng. Chia sáº» mĂ£ phĂ²ng Ä‘á»ƒ má»i Ä‘á»‘i thá»§!",
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
  const roomName = routeState?.roomName ?? "PhĂ²ng Ä‘áº¥u nhanh";
  const roomCode = routeState?.roomCode ?? "AB12CD";
  const roomId   = routeState?.roomId   ?? "room-001";
  const username = currentUser.username  ?? "admin";
  const displayName = getUserDisplayName(currentUser);

  if (!routeState || routeState.source === "create") {
    return {
      id: roomId, name: roomName, code: roomCode,
      status: "waiting", maxPlayers: 2,
      players: [{
        id: CURRENT_USER_ID, username, displayName,
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
        id: CURRENT_USER_ID, username, displayName,
        isHost: false, isReady: false, online: true,
        rating: currentUser.elo ?? DEFAULT_ELO, color: "black",
      },
    ],
  };
}

// â”€â”€ EloRank badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EloRank({ rating }: { rating: number }) {
  // Room page rank badge follows the shared Elo mapping used by Lobby/Board.
  const rank = getRankByElo(rating);

  return (
    <span className={`rp-elo-tag rp-elo-${rank.tier}`}>
      {getEloRankLabel(rating)}
    </span>
  );
}

// â”€â”€ PlayerCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PlayerCard({ player, slot }: { player: PlayerSlot | null; slot: 1 | 2 }) {
  if (!player) {
    return (
      <div className="rp-player-card rp-player-card--empty">
        <div className="rp-player-avatar rp-player-avatar--empty">
          {slot === 1 ? "â™”" : "â™"}
        </div>
        <p className="rp-player-empty-text">Chá» ngÆ°á»i chÆ¡i...</p>
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
          <span className="rp-host-crown" title="Chá»§ phĂ²ng">
            â™›
          </span>
        )}
      </div>

      <div className="rp-player-info">
        <p className="rp-player-name">{player.displayName}</p>
        <EloRank rating={player.rating} />
        {player.color && (
          <span className={`rp-color-badge rp-color-badge--${player.color}`}>
            {player.color === "white" ? "â™” Tráº¯ng" : "â™ Äen"}
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
          ? "âœ“ Sáºµn sĂ ng"
          : "ChÆ°a sáºµn sĂ ng"}
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
      <h3 className="rp-settings-title">â™ TĂ¹y chá»‰nh phĂ²ng Ä‘áº¥u</h3>

      {/* TĂªn phĂ²ng */}
      <div className="rp-settings-group">
        <label className="rp-settings-label">TĂªn phĂ²ng</label>

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
              title="LÆ°u"
            >
              âœ“
            </button>
            <button
              type="button"
              className="rp-icon-btn rp-icon-btn--cancel"
              onClick={() => setEditingName(false)}
              title="Huá»·"
            >
              âœ•
            </button>
          </div>
        ) : (
          <div className="rp-name-display-row">
            <span className="rp-settings-value">{settings.roomName}</span>
            {isHost && (
              <button type="button" className="rp-edit-btn" onClick={startEdit}>
                âœ Äá»•i tĂªn
              </button>
            )}
          </div>
        )}
      </div>

      {/* MĂ u quĂ¢n */}
      <div className="rp-settings-group">
        <label className="rp-settings-label">MĂ u quĂ¢n cá»§a Host</label>
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
              {c === "white" ? "â™” Tráº¯ng" : c === "black" ? "â™ Äen" : "đŸ”€ Random"}
            </button>
          ))}
        </div>
      </div>

      {/* Thá»i gian */}
      <div className="rp-settings-group">
        <label className="rp-settings-label">Thá»i gian vĂ¡n Ä‘áº¥u</label>
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
            <label className="rp-settings-label-sm">Sá»‘ phĂºt:</label>
            <input
              type="number"
              min={1}
              max={120}
              disabled={!isHost}
              className="rp-time-input"
              value={settings.customMinutes}
              onChange={(e) => onChange("customMinutes", Number(e.target.value))}
            />
            <span className="rp-settings-label-sm">phĂºt</span>
          </div>
        )}
      </div>

      {/* Bonus seconds */}
      <div className="rp-settings-group">
        <label className="rp-settings-label">
          Cá»™ng thĂªm má»—i nÆ°á»›c
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
          â  Chá»‰ chá»§ phĂ²ng má»›i cĂ³ thá»ƒ thay Ä‘á»•i cĂ i Ä‘áº·t
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
    setRoom((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === CURRENT_USER_ID ? { ...p, isReady: !p.isReady } : p
      ),
    }));
  };

  const handleStart = () => {
    if (!canStart) {
      alert("ChÆ°a Ä‘á»§ Ä‘iá»u kiá»‡n Ä‘á»ƒ báº¯t Ä‘áº§u tráº­n.");
      return;
    }
    navigate("/board", {
      state: { roomId: room.id, roomName: room.name, roomCode: room.code },
    });
  };

  const handleLeave = () => {
    //{Náº¿u vĂ o tá»« chÆ¡i nhanh thĂ¬ quay vá» Lobby, ngÆ°á»£c láº¡i vá» danh sĂ¡ch phĂ²ng}
    const target = routeState?.source === "quick-join" ? "/lobby" : "/rooms";
    navigate(target);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      alert("ÄĂ£ copy mĂ£ phĂ²ng!");
    } catch {
      alert("KhĂ´ng thá»ƒ copy mĂ£ phĂ²ng.");
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
            aria-label="Quay vá»"
          >
            <img src={logoImage} alt="Zess Online Chess" />
          </button>

          <div className="room-topbar-center">
            <div className="room-topbar-info-item">
              <span className="room-topbar-label">MĂ£ phĂ²ng</span>
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
              <span className="room-topbar-label">TĂªn phĂ²ng</span>
              <span className="room-topbar-name">{room.name}</span>
            </div>

            <div className="room-topbar-sep" />

            <div className="room-topbar-info-item">
              <span className="room-topbar-label">NgÆ°á»i chÆ¡i</span>
              <span className="room-topbar-name">
                {playerCount}/{room.maxPlayers}
              </span>
            </div>
          </div>

          <div className={`room-topbar-status ${canStart ? "room-topbar-status--ready" : ""}`}>
            <span className="room-status-dot" />
            {canStart ? "Sáºµn sĂ ng báº¯t Ä‘áº§u" : "Äang chá» ngÆ°á»i chÆ¡i"}
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
                  {currentPlayer?.isReady ? "âŸ³ Há»§y sáºµn sĂ ng" : "âœ“ Sáºµn sĂ ng"}
                </button>
              )}

              <button
                type="button"
                className="rp-btn rp-btn--start"
                onClick={handleStart}
                disabled={!canStart}
                title={
                  !canStart
                    ? "Cáº§n Ä‘á»§ 2 ngÆ°á»i vĂ  Ä‘á»‘i thá»§ Ä‘Ă£ sáºµn sĂ ng"
                    : undefined
                }
              >
                â–¶ Báº¯t Ä‘áº§u vĂ¡n Ä‘áº¥u
              </button>

              <button
                type="button"
                className="rp-btn rp-btn--leave"
                onClick={handleLeave}
              >
                â† Rá»i phĂ²ng
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

export default RoomPage;
