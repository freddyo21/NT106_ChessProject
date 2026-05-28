import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_ELO } from "@zess-online-chess/shared";
import {
  getAppSocket,
  getSocketToken,
  type QuickMatchMatchedPayload,
} from "../services/socketClient";
import "./QuickMatchPage.css";

type QuickMatchRouteState = {
  username?: string;
  elo?: number;
};

type MatchmakingStatus = "idle" | "searching" | "matched" | "error";

function getQuickMatchElo(routeElo?: number) {
  // Route state may still carry the old demo Elo 1420; normalize it to the new 1200 default.
  if (routeElo === 1420) {
    return DEFAULT_ELO;
  }

  return typeof routeElo === "number" ? routeElo : DEFAULT_ELO;
}

function QuickMatchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as QuickMatchRouteState | null;
  const [status, setStatus] = useState<MatchmakingStatus>("idle");
  const [message, setMessage] = useState("");
  const [matchedPayload, setMatchedPayload] =
    useState<QuickMatchMatchedPayload | null>(null);
  const socketCleanupRef = useRef<(() => void) | null>(null);
  const matchStartTimeoutRef = useRef<number | null>(null);

  const playerName = routeState?.username ?? "Người chơi";
  const playerElo = getQuickMatchElo(routeState?.elo);

  useEffect(() => {
    return () => {
      if (matchStartTimeoutRef.current) {
        window.clearTimeout(matchStartTimeoutRef.current);
      }

      socketCleanupRef.current?.();
      getAppSocket()?.emit("quick_match:cancel");
    };
  }, []);

  const handleFindOpponent = () => {
    const token = getSocketToken();

    if (!token) {
      setStatus("error");
      setMessage("Chưa có accessToken để kết nối WebSocket.");
      return;
    }

    const socket = getAppSocket();

    if (!socket) {
      setStatus("error");
      setMessage("Không khởi tạo được WebSocket.");
      return;
    }

    setStatus("searching");
    setMessage("");
    setMatchedPayload(null);
    socketCleanupRef.current?.();

    const handleConnectError = (error: Error) => {
      setStatus("error");
      setMessage(error.message || "Không kết nối được WebSocket.");
    };

    const handleMatched = (payload: QuickMatchMatchedPayload) => {
      setMatchedPayload(payload);
      setStatus("matched");
      // Join the game room immediately so board state exists before navigating to /board.
      socket.emit("join_room", payload.roomId);

      if (matchStartTimeoutRef.current) {
        window.clearTimeout(matchStartTimeoutRef.current);
      }

      matchStartTimeoutRef.current = window.setTimeout(() => {
        navigate("/board", {
          state: {
            roomId: payload.roomId,
            roomName: "Phòng đấu nhanh",
            roomCode: payload.roomId,
            playerColor: payload.color,
            opponentName: payload.opponent.username,
            opponentElo: payload.opponent.elo,
            // Board displays the authenticated player's current Elo.
            playerElo,
          },
        });
      }, 2000);
    };

    const handleDisconnect = () => {
      setStatus((currentStatus) =>
        currentStatus === "matched" ? currentStatus : "error"
      );
      setMessage("WebSocket đã ngắt kết nối.");
    };

    const handleRoomError = (roomMessage: string) => {
      setStatus("error");
      setMessage(roomMessage || "Không thể tham gia phòng đấu.");
    };

    socket.on("connect_error", handleConnectError);
    socket.on("quick_match:matched", handleMatched);
    socket.on("disconnect", handleDisconnect);
    socket.on("room_error", handleRoomError);

    socketCleanupRef.current = () => {
      socket.off("connect_error", handleConnectError);
      socket.off("quick_match:matched", handleMatched);
      socket.off("disconnect", handleDisconnect);
      socket.off("room_error", handleRoomError);
    };

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("quick_match:join", (payload) => {
      if (!payload?.ok) {
        setStatus("error");
        setMessage(payload?.message || "Không thể vào hàng chờ ghép trận.");
      }
    });
  };

  const handleBackToLobby = () => {
    if (matchStartTimeoutRef.current) {
      window.clearTimeout(matchStartTimeoutRef.current);
    }

    getAppSocket()?.emit("quick_match:cancel");
    navigate("/lobby");
  };

  return (
    <div className="quick-match-page">
      <main className="quick-match-shell">
        <h1>Chơi ngay</h1>

        <section className="quick-match-card" aria-live="polite">
          {status === "idle" && (
            <>
              <p className="quick-match-message">
                Nhấn "Tìm đối thủ" để tìm đối thủ
              </p>
              <button
                type="button"
                className="quick-match-find-btn"
                onClick={handleFindOpponent}
              >
                Tìm đối thủ
              </button>
            </>
          )}

          {status === "searching" && (
            <>
              <p className="quick-match-message">Đang tìm đối thủ...</p>
              <div className="quick-match-loader" aria-hidden="true" />
              <p className="quick-match-note">Hãy giữ kết nối trong lúc ghép trận.</p>
            </>
          )}

          {status === "matched" && (
            <>
              <p className="quick-match-message">Đã tìm thấy đối thủ!</p>
              <p className="quick-match-note">Trận đấu sẽ bắt đầu sau 2 giây</p>

              <div className="quick-match-opponent">
                <div className="quick-match-avatar">
                  {(matchedPayload?.opponent.username || "OP").slice(0, 2).toUpperCase()}
                </div>
                <strong>{matchedPayload?.opponent.username || "Đối thủ"}</strong>
                <span>{matchedPayload?.color === "white" ? "Bạn cầm trắng" : "Bạn cầm đen"}</span>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <p className="quick-match-message">Chưa thể ghép trận</p>
              <p className="quick-match-note">{message}</p>
              <button
                type="button"
                className="quick-match-find-btn"
                onClick={handleFindOpponent}
              >
                Thử lại
              </button>
            </>
          )}
        </section>

        <div className="quick-match-player">
          {playerName} <span>|</span> Elo {playerElo}
        </div>

        <button
          type="button"
          className="quick-match-back-btn"
          onClick={handleBackToLobby}
        >
          Quay về sảnh
        </button>
      </main>
    </div>
  );
}

export default QuickMatchPage;
