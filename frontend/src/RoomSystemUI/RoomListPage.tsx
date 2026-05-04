import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logoImage from "../Image/ZessOnlChessLogoDon.svg";
import "./RoomListPage.css";

type RoomStatus = "waiting" | "playing" | "full";

type DemoSessionUser = {
  email: string;
  displayName: string;
  username: string;
};

type RoomListItem = {
  id: string;
  roomName: string;
  roomCode: string;
  hostName: string;
  hostElo: number;
  players: number;
  maxPlayers: number;
  status: RoomStatus;
  createdAt: string;
};

const USER_STORAGE_KEY = "zess_demo_user";

const mockRooms: RoomListItem[] = [
  {
    id: "room-101",
    roomName: "Phòng của LyNa",
    roomCode: "LYN291",
    hostName: "LyNa",
    hostElo: 1650,
    players: 1,
    maxPlayers: 2,
    status: "waiting",
    createdAt: "09:18",
  },
  {
    id: "room-102",
    roomName: "Rank nhanh cùng Ngọc",
    roomCode: "NGC158",
    hostName: "Ngoc",
    hostElo: 1580,
    players: 2,
    maxPlayers: 2,
    status: "playing",
    createdAt: "09:21",
  },
  {
    id: "room-103",
    roomName: "DuyAnh Testing Room",
    roomCode: "DUY495",
    hostName: "DuyAnh",
    hostElo: 1495,
    players: 1,
    maxPlayers: 2,
    status: "waiting",
    createdAt: "09:24",
  },
  {
    id: "room-104",
    roomName: "Casual Chess",
    roomCode: "CAS420",
    hostName: "HoKR2911",
    hostElo: 1420,
    players: 1,
    maxPlayers: 2,
    status: "waiting",
    createdAt: "09:26",
  },
];

function getDemoUser(): DemoSessionUser {
  //{giải thích code} Lấy thông tin user demo trong localStorage để tạo phòng theo đúng tài khoản hiện tại.
  const fallbackUser: DemoSessionUser = {
    email: "admin@gmail.com",
    displayName: "Lake",
    username: "HoKR2911",
  };

  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);

    if (!rawUser) {
      return fallbackUser;
    }

    const parsedUser = JSON.parse(rawUser) as DemoSessionUser;

    if (parsedUser.email && parsedUser.displayName && parsedUser.username) {
      return parsedUser;
    }

    return fallbackUser;
  } catch {
    return fallbackUser;
  }
}

function createRandomRoomCode() {
  //{giải thích code} Sinh mã phòng demo; sau này backend có thể trả roomCode thật thay vì frontend tự tạo.
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < 6; i += 1) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
}

function normalizeRoomCode(value: string) {
  //{giải thích code} Chuẩn hóa mã phòng để tránh lỗi do viết thường hoặc dư khoảng trắng.
  return value.trim().toUpperCase();
}

function getStatusLabel(status: RoomStatus) {
  //{giải thích code} Chuyển trạng thái kỹ thuật sang chữ tiếng Việt để hiển thị trên UI.
  if (status === "waiting") return "Đang chờ";
  if (status === "playing") return "Đang đấu";
  return "Đã đầy";
}

function getStatusClass(status: RoomStatus) {
  //{giải thích code} Trả class CSS riêng cho từng trạng thái phòng.
  if (status === "waiting") return "waiting";
  if (status === "playing") return "playing";
  return "full";
}

function canJoinRoom(room?: RoomListItem) {
  //{giải thích code} Chỉ cho vào phòng đang chờ và còn slot; không có spectate nên phòng đang đấu/đã đầy bị khóa.
  return !!room && room.status === "waiting" && room.players < room.maxPlayers;
}

function RoomListPage() {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomListItem[]>(mockRooms);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");

  const currentUser = useMemo(() => getDemoUser(), []);

  const filteredRooms = useMemo(() => {
    //{giải thích code} Lọc danh sách phòng theo tên phòng hoặc tên chủ phòng.
    const keyword = searchKeyword.trim().toLowerCase();

    if (!keyword) {
      return rooms;
    }

    return rooms.filter((room) => {
      return (
        room.roomName.toLowerCase().includes(keyword) ||
        room.hostName.toLowerCase().includes(keyword)
      );
    });
  }, [rooms, searchKeyword]);

  const selectedRoom = useMemo(() => {
    //{giải thích code} Lấy phòng đang được chọn để quyết định nút "Vào phòng" có được bấm hay không.
    return rooms.find((room) => room.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  const isJoinButtonDisabled = !canJoinRoom(selectedRoom);

  const navigateToRoom = (room: RoomListItem, source: "join" | "create") => {
    //{giải thích code} Gom điều hướng vào phòng tại một chỗ để sau này dễ thay bằng dữ liệu socket/backend trả về.
    navigate("/room", {
      state: {
        source,
        roomId: room.id,
        roomName: room.roomName,
        roomCode: room.roomCode,
        hostName: room.hostName,
      },
    });
  };

  const handleBackToLobby = () => {
    //{giải thích code} Quay về Lobby chính.
    navigate("/lobby");
  };

  const handleRefreshRooms = () => {
    //{giải thích code} Hiện tại chỉ refresh mock data; sau này thay bằng socket.emit("room:list") hoặc API.
    setRooms((prevRooms) => [...prevRooms]);
  };

  const handleSelectRoom = (roomId: string) => {
    //{giải thích code} Lưu phòng đang chọn để người dùng có thể bấm nút "Vào phòng".
    setSelectedRoomId(roomId);
  };

  const handleCreateRoom = () => {
    //{giải thích code} Demo tạo phòng mới; sau này thay bằng socket.emit("room:create", payload).
    const newRoom: RoomListItem = {
      id: `room-${Date.now()}`,
      roomName: `Phòng của ${currentUser.username}`,
      roomCode: createRandomRoomCode(),
      hostName: currentUser.username,
      hostElo: 1420,
      players: 1,
      maxPlayers: 2,
      status: "waiting",
      createdAt: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    navigateToRoom(newRoom, "create");
  };

  const handleJoinSelectedRoom = () => {
    //{giải thích code} Join bằng phòng đang chọn trong danh sách; sau này thay bằng socket.emit("room:join", roomId).
    if (!selectedRoom) {
      alert("Bạn chưa chọn phòng.");
      return;
    }

    if (!canJoinRoom(selectedRoom)) {
      alert("Phòng này không thể vào vì đã đầy hoặc đang đấu.");
      return;
    }

    navigateToRoom(selectedRoom, "join");
  };

  const handleJoinByCode = () => {
    //{giải thích code} Join nhanh bằng mã phòng; sau này thay bằng socket.emit("room:join-by-code", normalizedCode).
    const normalizedCode = normalizeRoomCode(roomCodeInput);

    if (!normalizedCode) {
      alert("Bạn chưa nhập mã phòng.");
      return;
    }

    const matchedRoom = rooms.find((room) => {
      return room.roomCode.toUpperCase() === normalizedCode;
    });

    if (!matchedRoom) {
      alert("Không tìm thấy phòng với mã này.");
      return;
    }

    if (!canJoinRoom(matchedRoom)) {
      alert("Phòng này không thể vào vì đã đầy hoặc đang đấu.");
      return;
    }

    navigateToRoom(matchedRoom, "join");
  };

  const handleDoubleClickRoom = (room: RoomListItem) => {
    //{giải thích code} Cho phép double click vào phòng đang chờ để vào nhanh.
    if (!canJoinRoom(room)) {
      return;
    }

    navigateToRoom(room, "join");
  };

  return (
    <div className="room-list-page">
      <div className="room-list-desktop">
        <header className="room-list-topbar">
          <button
            type="button"
            className="room-list-logo-box"
            onClick={handleBackToLobby}
            aria-label="Quay về Lobby"
          >
            <img src={logoImage} alt="Zess Online Chess Logo" />
          </button>

          <div className="room-list-heading">
            <p>ZESS ONLINE CHESS</p>
            <h1>Danh sách phòng</h1>
          </div>
        </header>

        <main className="room-list-main">
          <section className="room-list-panel">
            <div className="room-list-toolbar">
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                className="room-list-search"
                placeholder="Tìm theo tên phòng hoặc chủ phòng..."
              />

              <div className="room-code-join-box">
                <input
                  value={roomCodeInput}
                  onChange={(event) =>
                    setRoomCodeInput(event.target.value.toUpperCase())
                  }
                  onKeyDown={(event) => {
                    //{giải thích code} Cho phép nhấn Enter để vào phòng bằng mã.
                    if (event.key === "Enter") {
                      handleJoinByCode();
                    }
                  }}
                  className="room-code-input"
                  placeholder="Nhập mã phòng..."
                  maxLength={8}
                />

                <button
                  type="button"
                  className="room-code-join-btn"
                  onClick={handleJoinByCode}
                >
                  Vào bằng mã
                </button>
              </div>
            </div>

            <div className="room-list-table-wrap">
              <table className="room-list-table">
                <thead>
                  <tr>
                    <th>Tên phòng</th>
                    <th>Chủ phòng</th>
                    <th>Elo</th>
                    <th>Người</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRooms.length === 0 ? (
                    <tr>
                      <td className="room-list-empty" colSpan={5}>
                        Không tìm thấy phòng phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((room) => {
                      const isSelected = room.id === selectedRoomId;
                      const isDisabled = !canJoinRoom(room);

                      return (
                        <tr
                          key={room.id}
                          className={[
                            "room-list-row",
                            isSelected ? "selected" : "",
                            isDisabled ? "disabled" : "",
                          ].join(" ")}
                          onClick={() => handleSelectRoom(room.id)}
                          onDoubleClick={() => handleDoubleClickRoom(room)}
                        >
                          <td>
                            <div className="room-list-name-cell">
                              <strong>{room.roomName}</strong>
                              <span>Tạo lúc {room.createdAt}</span>
                            </div>
                          </td>

                          <td>{room.hostName}</td>
                          <td>{room.hostElo}</td>
                          <td>
                            {room.players}/{room.maxPlayers}
                          </td>
                          <td>
                            <span
                              className={`room-list-status ${getStatusClass(
                                room.status
                              )}`}
                            >
                              {getStatusLabel(room.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="room-list-actions">
              <button
                type="button"
                className="room-list-action-btn secondary"
                onClick={handleRefreshRooms}
              >
                Làm mới
              </button>

              <button
                type="button"
                className="room-list-action-btn primary"
                onClick={handleCreateRoom}
              >
                Tạo phòng mới
              </button>

              <button
                type="button"
                className="room-list-action-btn back"
                onClick={handleBackToLobby}
              >
                Quay về sảnh
              </button>

              <button
                type="button"
                className="room-list-action-btn join"
                onClick={handleJoinSelectedRoom}
                disabled={isJoinButtonDisabled}
                title={
                  isJoinButtonDisabled
                    ? "Chỉ có thể vào phòng đang chờ và còn slot"
                    : "Vào phòng đã chọn"
                }
              >
                Vào phòng
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default RoomListPage;