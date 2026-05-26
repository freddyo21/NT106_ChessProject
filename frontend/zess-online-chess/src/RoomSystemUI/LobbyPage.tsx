import { useMemo, useState } from "react";
import "./LobbyPage.css";

type RoomStatus = "waiting" | "playing" | "full";

type RoomSummary = {
  id: string;
  name: string;
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
  isPrivate?: boolean;
};

type LobbyPageProps = {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
};

const mockRooms: RoomSummary[] = [
  
];

function LobbyPage({ onCreateRoom, onJoinRoom }: LobbyPageProps) {
  const [rooms] = useState<RoomSummary[]>(mockRooms);
  const [searchTerm, setSearchTerm] = useState("");
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const filteredRooms = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return rooms;

    return rooms.filter((room) => {
      return (
        room.name.toLowerCase().includes(keyword) ||
        room.code.toLowerCase().includes(keyword) ||
        room.hostName.toLowerCase().includes(keyword)
      );
    });
  }, [rooms, searchTerm]);

  const getStatusLabel = (status: RoomStatus) => {
    switch (status) {
      case "waiting":
        return "Đang chờ";
      case "playing":
        return "Đang đấu";
      case "full":
        return "Đã đầy";
      default:
        return "Không rõ";
    }
  };

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      alert("Vui lòng nhập tên phòng.");
      return;
    }
    onCreateRoom();
  };

  const handleJoinByCode = () => {
    if (!joinCode.trim()) {
      alert("Vui lòng nhập mã phòng.");
      return;
    }
    onJoinRoom();
  };

  const handleQuickJoin = (room: RoomSummary) => {
    if (room.status === "playing") {
      alert("Phòng này đang đấu.");
      return;
    }

    if (room.playerCount >= room.maxPlayers) {
      alert("Phòng này đã đầy.");
      return;
    }

    onJoinRoom();
  };

  return (
    <div className="lobby-page">
      <div className="lobby-shell">
        <div className="lobby-header">
          <div>
            <p className="lobby-kicker">ROOM SYSTEM</p>
            <h1>Lobby / Sảnh chờ</h1>
            <p className="lobby-subtitle">
              Tạo phòng, nhập mã phòng hoặc tham gia nhanh vào phòng đang chờ.
            </p>
          </div>

          <div className="lobby-user-box">
            <div className="lobby-avatar">MH</div>
            <div>
              <p className="lobby-user-name">Người chơi</p>
              <p className="lobby-user-meta">Desktop Client</p>
            </div>
          </div>
        </div>

        <div className="lobby-top-grid">
          <section className="lobby-panel create-panel">
            <div className="panel-title-row">
              <h2>Tạo phòng mới</h2>
              <span className="panel-tag">Host</span>
            </div>

            <label className="field-label">Tên phòng</label>
            <input
              className="room-input"
              type="text"
              placeholder="Ví dụ: Phòng đấu của MH"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />

            <label className="field-label">Chế độ phòng</label>
            <div className="toggle-row">
              <button
                type="button"
                className={`toggle-btn ${!isPrivate ? "active" : ""}`}
                onClick={() => setIsPrivate(false)}
              >
                Công khai
              </button>
              <button
                type="button"
                className={`toggle-btn ${isPrivate ? "active" : ""}`}
                onClick={() => setIsPrivate(true)}
              >
                Riêng tư
              </button>
            </div>

            <button className="primary-btn" onClick={handleCreateRoom}>
              Tạo phòng
            </button>
          </section>

          <section className="lobby-panel join-panel">
            <div className="panel-title-row">
              <h2>Vào phòng bằng mã</h2>
              <span className="panel-tag">Join</span>
            </div>

            <label className="field-label">Room Code</label>
            <input
              className="room-input code-input"
              type="text"
              placeholder="Nhập mã, ví dụ AB12CD"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={10}
            />

            <button className="primary-btn" onClick={handleJoinByCode}>
              Tham gia phòng
            </button>
          </section>
        </div>

        <section className="lobby-panel list-panel">
          <div className="list-panel-header">
            <div>
              <h2>Danh sách phòng</h2>
              <p>{filteredRooms.length} phòng hiển thị</p>
            </div>

            <input
              className="search-input"
              type="text"
              placeholder="Tìm theo tên phòng, host, mã phòng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="room-list">
            {filteredRooms.length > 0 ? (
              filteredRooms.map((room) => (
                <div className="room-card" key={room.id}>
                  <div className="room-card-left">
                    <div className="room-card-top">
                      <h3>{room.name}</h3>
                      <span className={`status-badge ${room.status}`}>
                        {getStatusLabel(room.status)}
                      </span>
                    </div>

                    <div className="room-meta-grid">
                      <p><span>Mã phòng:</span> {room.code}</p>
                      <p><span>Chủ phòng:</span> {room.hostName}</p>
                      <p><span>Người chơi:</span> {room.playerCount}/{room.maxPlayers}</p>
                      <p><span>Quyền riêng tư:</span> {room.isPrivate ? "Riêng tư" : "Công khai"}</p>
                    </div>
                  </div>

                  <div className="room-card-right">
                    <button
                      className="ghost-btn"
                      onClick={() => navigator.clipboard.writeText(room.code)}
                    >
                      Copy code
                    </button>
                    <button
                      className="primary-btn"
                      onClick={() => handleQuickJoin(room)}
                    >
                      Vào phòng
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">Không tìm thấy phòng nào phù hợp.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default LobbyPage;