import { useMemo, useState } from "react";
import "./RoomPage.css";

type PlayerSlot = {
  id: string;
  username: string;
  isHost: boolean;
  isReady: boolean;
  online: boolean;
  rating?: number;
  color?: "white" | "black";
};

type RoomData = {
  id: string;
  name: string;
  code: string;
  status: "waiting" | "ready_to_start" | "playing";
  players: PlayerSlot[];
  maxPlayers: number;
};

type RoomPageProps = {
  onBackToLobby: () => void;
  onStartGame: () => void;
};

const mockRoom: RoomData = {
  id: "room-001",
  name: "Phòng đấu nhanh",
  code: "AB12CD",
  status: "waiting",
  maxPlayers: 2,
  players: [
    {
      id: "u1",
      username: "MH",
      isHost: true,
      isReady: false,
      online: true,
      rating: 1420,
      color: "white",
    },
  ],
};

function RoomPage({ onBackToLobby, onStartGame }: RoomPageProps) {
  const [room, setRoom] = useState<RoomData>(mockRoom);
  const currentUserId = "u1";

  const currentUser = useMemo(
    () => room.players.find((player) => player.id === currentUserId),
    [room.players]
  );

  const isHost = !!currentUser?.isHost;
  const playerCount = room.players.length;
  const hasEnoughPlayers = playerCount === room.maxPlayers;
  const allNonHostReady = room.players
    .filter((player) => !player.isHost)
    .every((player) => player.isReady);

  const canStart = hasEnoughPlayers && allNonHostReady;

  const handleToggleReady = () => {
    setRoom((prev) => ({
      ...prev,
      players: prev.players.map((player) =>
        player.id === currentUserId
          ? { ...player, isReady: !player.isReady }
          : player
      ),
    }));
  };

  const handleAddMockOpponent = () => {
    if (room.players.length >= room.maxPlayers) {
      alert("Phòng đã đủ người.");
      return;
    }

    setRoom((prev) => ({
      ...prev,
      players: [
        ...prev.players,
        {
          id: "u2",
          username: "LyNa",
          isHost: false,
          isReady: false,
          online: true,
          rating: 1510,
          color: "black",
        },
      ],
    }));
  };

  const handleStart = () => {
    if (!canStart) {
      alert("Chưa đủ điều kiện để bắt đầu trận.");
      return;
    }
    onStartGame();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      alert("Đã copy mã phòng.");
    } catch {
      alert("Không thể copy mã phòng.");
    }
  };

  const getRoomStatusText = () => {
    if (room.status === "playing") return "Đang thi đấu";
    if (canStart) return "Sẵn sàng bắt đầu";
    return "Đang chờ người chơi";
  };

  return (
    <div className="room-page">
      <div className="room-shell">
        <div className="room-header">
          <div>
            <p className="room-kicker">ROOM DETAIL</p>
            <h1>{room.name}</h1>
            <p className="room-subtitle">
              Theo dõi trạng thái phòng, người chơi, mã phòng và chuẩn bị vào trận.
            </p>
          </div>

          <div className="room-code-box">
            <span>Room Code</span>
            <strong>{room.code}</strong>
            <button className="ghost-btn small-btn" onClick={handleCopyCode}>
              Copy
            </button>
          </div>
        </div>

        <div className="room-main-grid">
          <section className="room-panel room-info-panel">
            <div className="section-head">
              <h2>Thông tin phòng</h2>
              <span className="status-pill">{getRoomStatusText()}</span>
            </div>

            <div className="info-grid">
              <div className="info-card">
                <span>ID phòng</span>
                <strong>{room.id}</strong>
              </div>
              <div className="info-card">
                <span>Mã phòng</span>
                <strong>{room.code}</strong>
              </div>
              <div className="info-card">
                <span>Số người chơi</span>
                <strong>{playerCount}/{room.maxPlayers}</strong>
              </div>
              <div className="info-card">
                <span>Trạng thái</span>
                <strong>{getRoomStatusText()}</strong>
              </div>
            </div>
          </section>

          <section className="room-panel player-panel">
            <div className="section-head">
              <h2>Người chơi trong phòng</h2>
              <span className="player-count-tag">{playerCount} người</span>
            </div>

            <div className="player-slot-list">
              {Array.from({ length: room.maxPlayers }).map((_, index) => {
                const player = room.players[index];

                if (!player) {
                  return (
                    <div className="player-slot empty" key={`empty-${index}`}>
                      <div className="player-avatar empty-avatar">?</div>
                      <div className="player-slot-main">
                        <p className="player-name">Đang chờ người chơi...</p>
                        <p className="player-meta">Slot trống</p>
                      </div>
                      <div className="player-ready-badge waiting">WAITING</div>
                    </div>
                  );
                }

                return (
                  <div className="player-slot" key={player.id}>
                    <div className={`player-avatar ${player.id === currentUserId ? "self" : "enemy"}`}>
                      {player.username.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="player-slot-main">
                      <div className="player-top-line">
                        <p className="player-name">
                          {player.username}
                          {player.isHost ? " (Host)" : ""}
                        </p>
                        <span className={`online-dot ${player.online ? "online" : "offline"}`} />
                      </div>

                      <p className="player-meta">
                        {player.color === "white"
                          ? "Quân trắng"
                          : player.color === "black"
                          ? "Quân đen"
                          : "Chưa gán màu"}
                        {player.rating ? ` • ELO ${player.rating}` : ""}
                      </p>
                    </div>

                    <div
                      className={`player-ready-badge ${
                        player.isHost ? "host" : player.isReady ? "ready" : "not-ready"
                      }`}
                    >
                      {player.isHost ? "HOST" : player.isReady ? "READY" : "NOT READY"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="room-panel room-action-panel">
            <div className="section-head">
              <h2>Điều khiển phòng</h2>
              <span className="section-note">Mock local state</span>
            </div>

            <div className="action-stack">
              {!isHost && (
                <button className="primary-btn" onClick={handleToggleReady}>
                  {currentUser?.isReady ? "Hủy sẵn sàng" : "Sẵn sàng"}
                </button>
              )}

              {isHost && (
                <>
                  <button className="primary-btn" onClick={handleStart}>
                    Bắt đầu trận
                  </button>
                  <button className="ghost-btn" onClick={handleAddMockOpponent}>
                    Thêm đối thủ giả
                  </button>
                </>
              )}

              <button className="ghost-btn danger-btn" onClick={onBackToLobby}>
                Rời phòng
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default RoomPage;