import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_ELO } from "@zess-online-chess/shared";
import OnlinePlayers, { type OnlinePlayer } from "../OnlinePlayersUI/OnlinePlayers";
import ChatUI, { type ChatMessage } from "../ChatUI/ChatUI";
import coverImage from "../Image/Cover2.jpg";
import logoImage from "../Image/ZessOnlChessLogoDon.svg";
import lobbyIcon from "../Image/LobbyIcon.svg";
import { HttpClient } from "../services/HttpClient";
import {
  disconnectAppSocket,
  getAppSocket,
  type AiDifficulty,
  type LobbyMessagePayload,
  type PresenceUser,
} from "../services/socketClient";
import {
  clearAuthSession,
  getCurrentUser,
  getUserDisplayName,
} from "../services/authSession";
import { userLogout } from "../services/auth.services";
import "./LobbyPage.css";

function formatSocketTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createLobbyMessageId() {
  // Client id is reused by backend echo so optimistic chat can dedupe cleanly.
  return `lobby-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const AI_DIFFICULTY_OPTIONS: Array<{ value: AiDifficulty; label: string }> = [
  { value: "easy", label: "D\u1ec5" },
  { value: "medium", label: "Trung b\u00ecnh" },
  { value: "hard", label: "Kh\u00f3" },
];

type LeaderboardApiEntry = {
  userId: string;
  rating: number | string;
};

async function fetchLobbyEloByUserId() {
  const response = await HttpClient.get<{ data: { entries: LeaderboardApiEntry[] } }>(
    "/leaderboard",
    { params: { page: 1, pageSize: 100, minGamesPlayed: 0 } }
  );

  return new Map(
    response.data.data.entries.map((entry) => [entry.userId, Number(entry.rating) || DEFAULT_ELO])
  );
}

function mapPresenceToOnlinePlayer(user: PresenceUser, currentUserId?: string, currentElo?: number): OnlinePlayer {
  // Presence comes from authenticated sockets, so no mock online list is kept on the client.
  return {
    id: user.userId,
    displayName: user.displayName || user.username,
    elo: user.userId === currentUserId ? currentElo ?? user.elo : user.elo,
    status: user.status,
    subtitle: "\u0110ang \u1edf s\u1ea3nh ch\u00ednh",
  };
}

function LobbyPage() {
  const navigate = useNavigate();
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [lobbyMessages, setLobbyMessages] = useState<ChatMessage[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>("medium");

  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentElo = currentUser?.elo ?? DEFAULT_ELO;
  const currentDisplayName = currentUser ? getUserDisplayName(currentUser) : "";

  useEffect(() => {
    if (!currentUser) {
      navigate("/login", { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const socket = getAppSocket();
    let cancelled = false;

    if (!socket || !currentUser) {
      return;
    }

    const refreshOnlineRatings = () => {
      void fetchLobbyEloByUserId()
        .then((eloByUserId) => {
          if (cancelled) return;

          setOnlinePlayers((prevPlayers) =>
            prevPlayers.map((player) => ({
              ...player,
              elo: player.id === currentUser.id
                ? currentElo
                : eloByUserId.get(player.id) ?? player.elo,
            }))
          );
        })
        .catch(() => undefined);
    };

    const handlePresenceList = (users: PresenceUser[]) => {
      setOnlinePlayers(users.map((user) => mapPresenceToOnlinePlayer(user, currentUser.id, currentElo)));
      refreshOnlineRatings();
    };

    const handleUserOnline = (user: PresenceUser) => {
      setOnlinePlayers((prevPlayers) => {
        const nextPlayer = mapPresenceToOnlinePlayer(user, currentUser.id, currentElo);
        const existingIndex = prevPlayers.findIndex((player) => player.id === nextPlayer.id);

        if (existingIndex >= 0) {
          const nextPlayers = [...prevPlayers];
          nextPlayers[existingIndex] = nextPlayer;
          return nextPlayers;
        }

        return [...prevPlayers, nextPlayer];
      });
      refreshOnlineRatings();
    };

    const handleUserOffline = ({ userId }: { userId: string }) => {
      setOnlinePlayers((prevPlayers) => prevPlayers.filter((player) => player.id !== userId));
    };

    const handleLobbyMessage = (payload: LobbyMessagePayload) => {
      setLobbyMessages((prevMessages) => {
        const serverMessage: ChatMessage = {
          id: payload.id,
          sender: payload.sender,
          text: payload.text,
          timestamp: formatSocketTimestamp(payload.timestamp),
          isOwn: payload.sender === currentUser.username,
        };
        const existingIndex = prevMessages.findIndex((message) => message.id === payload.id);

        if (existingIndex >= 0) {
          const nextMessages = [...prevMessages];
          nextMessages[existingIndex] = serverMessage;
          return nextMessages;
        }

        return [...prevMessages, serverMessage];
      });
    };

    socket.on("presence:list", handlePresenceList);
    socket.on("presence:user_online", handleUserOnline);
    socket.on("presence:user_offline", handleUserOffline);
    socket.on("lobby:message", handleLobbyMessage);

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("lobby:join");
    socket.emit("presence:list", handlePresenceList);

    return () => {
      cancelled = true;
      socket.off("presence:list", handlePresenceList);
      socket.off("presence:user_online", handleUserOnline);
      socket.off("presence:user_offline", handleUserOffline);
      socket.off("lobby:message", handleLobbyMessage);
    };
  }, [currentElo, currentUser]);

  const handleOpenLeaderboard = () => navigate("/leaderboard");
  const handleOpenMatchHistory = () => navigate("/match-history");
  const handleOpenPlayerProfile = () => navigate("/profile");
  const handleOpenRoomList = () => navigate("/rooms");

  const handleQuickPlay = () => {
    if (!currentUser) return;

    navigate("/quick-match", {
      state: {
        username: currentUser.username,
        elo: currentElo,
      },
    });
  };

  const handlePlayAi = () => {
    if (!currentUser) return;

    const socket = getAppSocket();
    if (!socket) {
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("ai:start", { difficulty: aiDifficulty }, (response) => {
      if (!response.ok || !response.roomId) {
        alert("KhÃ´ng thá»ƒ báº¯t Ä‘áº§u vÃ¡n vá»›i AI.");
        return;
      }

      navigate("/board", {
        state: {
          roomId: response.roomId,
          gameId: response.roomId,
          roomName: `Ch\u01a1i v\u1edbi AI - ${AI_DIFFICULTY_OPTIONS.find((option) => option.value === aiDifficulty)?.label ?? "Trung b\u00ecnh"}`,
          roomCode: response.roomId,
          playerColor: "white",
          opponentName: "Zess AI",
          opponentElo: DEFAULT_ELO,
          playerElo: currentElo,
        },
      });
    });
  };

  const handleLogout = () => {
    disconnectAppSocket();
    void userLogout().catch(() => undefined);
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  const handleSendLobbyMessage = (message: string) => {
    if (!currentUser) return;

    const clientId = createLobbyMessageId();
    const optimisticMessage: ChatMessage = {
      id: clientId,
      sender: currentUser.username,
      text: message,
      timestamp: formatSocketTimestamp(new Date().toISOString()),
      isOwn: true,
    };

    setLobbyMessages((prevMessages) => [...prevMessages, optimisticMessage]);

    const socket = getAppSocket();

    if (!socket) {
      return;
    }

    socket.emit("lobby:send_message", { message, clientId }, (response) => {
      if (response.ok) {
        return;
      }

      setLobbyMessages((prevMessages) =>
        prevMessages.filter((chatMessage) => chatMessage.id !== clientId)
      );
    });
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="lobby-page">
      <div className="lobby-desktop">
        <header className="lobby-topbar">
          <button
            type="button"
            className="lobby-logo-box"
            onClick={() => navigate("/lobby")}
            aria-label="Quay vá» Lobby"
          >
            <img src={logoImage} alt="Zess Online Chess Logo" />
          </button>

          <nav className="lobby-nav" aria-label="Lobby navigation">
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
              title="Má»Ÿ Profile"
            >
              {currentUser.username} <span>|</span> Elo {currentElo}
            </button>

            <a
              href="https://vi.wikipedia.org/wiki/C%E1%BB%9D_vua"
              target="_blank"
              rel="noreferrer"
              className="lobby-help-btn"
              title="HÆ°á»›ng dáº«n Cá» Vua - Wikipedia"
              aria-label="HÆ°á»›ng dáº«n Cá» Vua"
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

        <section
          className="lobby-cover"
          style={{ backgroundImage: `url(${coverImage})` }}
          aria-label="Cover Photo"
        >
          <div className="lobby-cover-overlay">
            <p className="lobby-cover-kicker">ZESS ONLINE CHESS</p>
            <h1>Lobby</h1>
          </div>
        </section>

        <section className="lobby-action-row" aria-label="Lobby actions">
          <button
            type="button"
            className="lobby-main-btn primary"
            onClick={handleQuickPlay}
          >
            Chơi ngay
          </button>
          <div className="lobby-ai-action">
            <div className="lobby-ai-difficulty" role="group" aria-label={"\u0110\u1ed9 kh\u00f3 AI"}>
              {AI_DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={aiDifficulty === option.value ? "active" : ""}
                  onClick={() => setAiDifficulty(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          <button
            type="button"
            className="lobby-main-btn ai"
            onClick={handlePlayAi}
          >
              Chơi với AI
          </button>
          </div>
          <button
            type="button"
            className="lobby-main-btn secondary"
            onClick={handleOpenRoomList}
          >
            Danh sách phòng
          </button>
        </section>

        <main className="lobby-content-grid">
          <div className="lobby-chat-panel">
            <ChatUI
              roomName="Lobby Chat"
              currentUserName={currentDisplayName || currentUser.username}
              messages={lobbyMessages}
              onSendText={handleSendLobbyMessage}
              avatarSrc={lobbyIcon}
            />
          </div>

          <aside className="lobby-players-panel">
            <div className="lobby-players-scroll">
              <OnlinePlayers players={onlinePlayers} />
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default LobbyPage;
