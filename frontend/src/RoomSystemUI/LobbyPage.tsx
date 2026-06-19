import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_ELO } from "@zess-online-chess/shared";
import OnlinePlayers, { type OnlinePlayer } from "../OnlinePlayersUI/OnlinePlayers";
import ChatUI, { type ChatMessage } from "../ChatUI/ChatUI";
import coverImage from "../Image/Cover2.jpg";
import logoImage from "../Image/ZessOnlChessLogoDon.svg";
import lobbyIcon from "../Image/LobbyIcon.svg";
import {
  disconnectAppSocket,
  getAppSocket,
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

function mapPresenceToOnlinePlayer(user: PresenceUser): OnlinePlayer {
  // Presence comes from authenticated sockets, so no mock online list is kept on the client.
  return {
    id: user.userId,
    displayName: user.displayName || user.username,
    elo: user.elo,
    status: user.status,
    subtitle: "Đang ở sảnh chính",
  };
}

function LobbyPage() {
  const navigate = useNavigate();
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [lobbyMessages, setLobbyMessages] = useState<ChatMessage[]>([]);

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

    if (!socket || !currentUser) {
      return;
    }

    const handlePresenceList = (users: PresenceUser[]) => {
      setOnlinePlayers(users.map(mapPresenceToOnlinePlayer));
    };

    const handleUserOnline = (user: PresenceUser) => {
      setOnlinePlayers((prevPlayers) => {
        const nextPlayer = mapPresenceToOnlinePlayer(user);
        const existingIndex = prevPlayers.findIndex((player) => player.id === nextPlayer.id);

        if (existingIndex >= 0) {
          const nextPlayers = [...prevPlayers];
          nextPlayers[existingIndex] = nextPlayer;
          return nextPlayers;
        }

        return [...prevPlayers, nextPlayer];
      });
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
      socket.off("presence:list", handlePresenceList);
      socket.off("presence:user_online", handleUserOnline);
      socket.off("presence:user_offline", handleUserOffline);
      socket.off("lobby:message", handleLobbyMessage);
    };
  }, [currentUser]);

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
            aria-label="Quay về Lobby"
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
              title="Mở Profile"
            >
              {currentUser.username} <span>|</span> Elo {currentElo}
            </button>

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
            Chơi Ngay
          </button>
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
