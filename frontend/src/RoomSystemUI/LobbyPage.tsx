import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import OnlinePlayers, { type OnlinePlayer } from "../OnlinePlayersUI/OnlinePlayers";
import ChatUI, { type ChatMessage } from "../ChatUI/ChatUI";
import coverImage from "../Image/Cover2.jpg";
import logoImage from "../Image/ZessOnlChessLogoDon.svg";
import lobbyIcon from "../Image/LobbyIcon.svg"; 
import "./LobbyPage.css";

type DemoSessionUser = {
  email: string
  displayName: string;
  username: string;
};

type PlayerProfileStats = {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
};

const DEMO_AUTH_KEY = "zess_demo_logged_in";
const USER_STORAGE_KEY = "zess_demo_user";
const PROFILE_STORAGE_KEY = "zess_demo_profile";

const mockOnlinePlayers: OnlinePlayer[] = [
  {
    id: "player-01",
    displayName: "LyNa",
    elo: 1650,
    status: "online",
    subtitle: "Đang ở sảnh chính",
    activityText: "Sẵn sàng nhận lời mời đấu",
  },
  {
    id: "player-02",
    displayName: "Ngoc",
    elo: 1580,
    status: "playing",
    subtitle: "Đang đấu xếp hạng",
    activityText: "Ván đấu đang diễn ra",
  },
  {
    id: "player-03",
    displayName: "DuyAnh",
    elo: 1495,
    status: "idle",
    subtitle: "Đang chờ trong room riêng",
    activityText: "Có thể mời vào phòng",
  },
];

const initialLobbyChatMessages: ChatMessage[] = [
  {
    id: "msg-01",
    sender: "System",
    text: "Chào mừng bạn đến với Lobby của Zess Online Chess.",
    timestamp: "09:20",
    isOwn: false,
  },
  {
    id: "msg-02",
    sender: "LyNa",
    text: "Ai muốn test một ván nhanh không?",
    timestamp: "09:21",
    isOwn: false,
  },
];

function getDemoUser(): DemoSessionUser {
  const fallbackUser: DemoSessionUser = {
    email: "admin@gmail.com",
    displayName: "Lake",
    username: "HoKR2911",
  };

  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!rawUser) return fallbackUser;

    const parsedUser = JSON.parse(rawUser) as DemoSessionUser;

    if (parsedUser.displayName && parsedUser.username && parsedUser.email) {
      return parsedUser;
    }

    return fallbackUser;
  } catch {
    return fallbackUser;
  }
}

function getDemoProfileStats(): PlayerProfileStats {
  const fallbackProfile: PlayerProfileStats = {
    elo: 1420,
    wins: 24,
    losses: 10,
    draws: 6,
  };

  try {
    const rawProfile = localStorage.getItem(PROFILE_STORAGE_KEY);

    if (!rawProfile) {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(fallbackProfile));
      return fallbackProfile;
    }

    const parsedProfile = JSON.parse(rawProfile) as PlayerProfileStats;

    if (
      typeof parsedProfile.elo === "number" &&
      typeof parsedProfile.wins === "number" &&
      typeof parsedProfile.losses === "number" &&
      typeof parsedProfile.draws === "number"
    ) {
      return parsedProfile;
    }

    return fallbackProfile;
  } catch {
    return fallbackProfile;
  }
}

function createRandomRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < 6; i += 1) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
}

function LobbyPage() {
  const navigate = useNavigate();
  const [onlinePlayers] = useState<OnlinePlayer[]>(mockOnlinePlayers);

  const currentUser = useMemo(() => getDemoUser(), []);
  const currentProfile = useMemo(() => getDemoProfileStats(), []);

  const handleOpenLeaderboard = () => navigate("/leaderboard");
  const handleOpenMatchHistory = () => navigate("/match-history");
  const handleOpenPlayerProfile = () => navigate("/player-profile");
  const handleOpenRoomList = () => navigate("/rooms");

  const handleQuickPlay = () => {
    navigate("/room", {
      state: {
        source: "quick-join",
        roomId: `quick-${Date.now()}`,
        roomName: "Phòng đấu nhanh",
        roomCode: createRandomRoomCode(),
        isPrivate: false,
        hostName: currentUser.username,
      },
    });
  };

  const handleLogout = () => {
    localStorage.removeItem(DEMO_AUTH_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    navigate("/login", { replace: true });
  };

  const handleInvitePlayer = (player: OnlinePlayer) => {
    alert(`Đã gửi lời mời đấu tới ${player.displayName}.`);
  };

  return (
    <div className="lobby-page">
      <div className="lobby-desktop">

        {/* ── TOPBAR ── */}
        <header className="lobby-topbar">
          {/* [1] Logo to hơn, bỏ hiệu ứng hover sáng */}
          <button
            type="button"
            className="lobby-logo-box"
            onClick={() => navigate("/lobby")}
            aria-label="Quay về Lobby"
          >
            <img src={logoImage} alt="Zess Online Chess Logo" />
          </button>

          <nav className="lobby-nav" aria-label="Lobby navigation">
            {/* [3] Bỏ chú giải — chỉ dùng text thuần */}
            <button type="button" className="lobby-nav-item active">
              Lobby
            </button>
            <button
              type="button"
              className="lobby-nav-item"
              onClick={handleOpenLeaderboard}
            >
              Leader Board
            </button>
            <button
              type="button"
              className="lobby-nav-item"
              onClick={handleOpenMatchHistory}
            >
              Match History
            </button>
          </nav>

          <div className="lobby-account-area">
            <button
              type="button"
              className="lobby-user-link"
              onClick={handleOpenPlayerProfile}
              title="Mở Profile"
            >
              {currentUser.username} <span>|</span> Elo {currentProfile.elo}
            </button>

            {/* "?" → Wikipedia Cờ Vua */}
            <a
              href="https://vi.wikipedia.org/wiki/C%E1%BB%9D_vua"
              target="_blank"
              rel="noreferrer"
              className="lobby-help-btn"
              title="Hướng dẫn Cờ Vua - Wikipedia"
              aria-label="Hướng dẫn Cờ Vua"
            >
              ?
            </a>

            <button
              type="button"
              className="lobby-logout-btn"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </header>

        {/* ── COVER ── */}
        <section
          className="lobby-cover"
          style={{ backgroundImage: `url(${coverImage})` }}
          aria-label="Cover Photo"
        >
          <div className="lobby-cover-overlay">
            <p className="lobby-cover-kicker">ZESS ONLINE CHESS</p>
            <h1>Lobby</h1>
            {/* [6] Bỏ dòng chữ nhỏ dưới LOBBY */}
          </div>
        </section>

        {/* ── ACTION ROW ── */}
        <section className="lobby-action-row" aria-label="Lobby actions">
          <button
            type="button"
            className="lobby-main-btn primary"
            onClick={handleQuickPlay}
          >
            Chơi Ngay
          </button>
          {/* [2] Đổi "DS Phòng" → "Danh sách phòng" */}
          <button
            type="button"
            className="lobby-main-btn secondary"
            onClick={handleOpenRoomList}
          >
            Danh sách phòng
          </button>
        </section>

        {/* ── CONTENT GRID ── */}
        <main className="lobby-content-grid">

          {/* [5] Truyền avatarSrc = LobbyIcon.svg thay chữ "L" */}
          <div className="lobby-chat-panel">
            <ChatUI
              roomName="Lobby Chat"
              currentUserName={currentUser.displayName || currentUser.username}
              initialMessages={initialLobbyChatMessages}
              avatarSrc={lobbyIcon}
            />
          </div>

          {/* [4] Bỏ lobby-online-strip — không hiện "4 User Online" nữa */}
          <aside className="lobby-players-panel">
            <div className="lobby-players-scroll">
              <OnlinePlayers
                players={onlinePlayers}
                onInvitePlayer={handleInvitePlayer}
              />
            </div>
          </aside>

        </main>
      </div>
    </div>
  );
}

export default LobbyPage;