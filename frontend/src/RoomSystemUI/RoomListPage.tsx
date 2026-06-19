import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_ELO } from "@zess-online-chess/shared";
import logoImage from "../Image/ZessOnlChessLogoDon.svg";
import { getAppSocket, type SocketRoomListItem } from "../services/socketClient";
import { getCurrentUser } from "../services/authSession";
import "./RoomListPage.css";

type RoomStatus = "waiting" | "playing" | "full";

type RoomListItem = SocketRoomListItem;

function getAuthenticatedUser() {
  return getCurrentUser();
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

function readUrlParam(url: URL, names: string[]) {
  for (const name of names) {
    const value = url.searchParams.get(name);

    if (value) {
      return value;
    }
  }

  return null;
}

function parseRoomJoinInput(value: string) {
  const rawInput = value.trim();

  if (!rawInput) {
    return null;
  }

  const tryParseUrl = (candidate: string) => {
    try {
      return new URL(candidate);
    } catch {
      return null;
    }
  };

  const looksLikeLink =
    rawInput.includes("://") ||
    rawInput.startsWith("#/") ||
    rawInput.includes("/") ||
    rawInput.includes("?") ||
    rawInput.includes("#") ||
    rawInput.includes(".");
  const parsedUrl =
    tryParseUrl(rawInput) ??
    (looksLikeLink ? tryParseUrl(`https://${rawInput}`) : null);

  if (!parsedUrl) {
    return { code: normalizeRoomCode(rawInput), roomId: rawInput };
  }

  const hashValue = parsedUrl.hash.replace(/^#\/?/, "");
  const hashSearchIndex = hashValue.indexOf("?");
  const hashPath =
    hashSearchIndex >= 0 ? hashValue.slice(0, hashSearchIndex) : hashValue;
  const hashSearch =
    hashSearchIndex >= 0 ? hashValue.slice(hashSearchIndex + 1) : "";
  const hashParams = new URLSearchParams(hashSearch);
  const pathSegments = [
    parsedUrl.hostname,
    ...parsedUrl.pathname.split("/"),
    ...hashPath.split("/"),
  ]
    .map((segment) => segment.trim())
    .filter(Boolean);
  const joinSegmentIndex = pathSegments.lastIndexOf("join");
  const roomIdFromPath =
    joinSegmentIndex >= 0 && joinSegmentIndex + 1 < pathSegments.length
      ? pathSegments[joinSegmentIndex + 1]
      : null;
  const code =
    readUrlParam(parsedUrl, ["code", "invite", "roomCode"]) ??
    hashParams.get("code") ??
    hashParams.get("invite") ??
    hashParams.get("roomCode");
  const roomId =
    readUrlParam(parsedUrl, ["roomId", "rid"]) ??
    hashParams.get("roomId") ??
    hashParams.get("rid") ??
    roomIdFromPath;

  return {
    code: code ? normalizeRoomCode(code) : null,
    roomId: roomId?.trim() || null,
  };
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

  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");

  const currentUser = useMemo(() => getAuthenticatedUser(), []);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login", { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const socket = getAppSocket();

    if (!socket) {
      return;
    }

    const handleRoomsSnapshot = (nextRooms: SocketRoomListItem[]) => {
      // Danh sách phòng lấy từ room-management socket, không dùng mock local nữa.
      setRooms(nextRooms);
      setSelectedRoomId((currentSelectedRoomId) =>
        nextRooms.some((room) => room.id === currentSelectedRoomId)
          ? currentSelectedRoomId
          : null
      );
    };

    socket.on("rooms:list", handleRoomsSnapshot);
    socket.on("rooms:changed", handleRoomsSnapshot);

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("rooms:list", handleRoomsSnapshot);

    return () => {
      socket.off("rooms:list", handleRoomsSnapshot);
      socket.off("rooms:changed", handleRoomsSnapshot);
    };
  }, []);

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
    // Room list enters the waiting room first; the room page starts the socket-backed board when ready.
    navigate("/room", {
      state: {
        source,
        roomId: room.id,
        roomName: room.roomName,
        roomCode: room.roomCode,
        hostName: room.hostName,
        hostElo: room.hostElo,
      },
    });
  };

  const handleBackToLobby = () => {
    //{giải thích code} Quay về Lobby chính.
    navigate("/lobby");
  };

  const handleRefreshRooms = () => {
    const socket = getAppSocket();

    // Chủ động request snapshot mới từ backend socket.
    socket?.emit("rooms:list", (nextRooms) => {
      setRooms(nextRooms);
    });
  };

  const handleSelectRoom = (roomId: string) => {
    //{giải thích code} Lưu phòng đang chọn để người dùng có thể bấm nút "Vào phòng".
    setSelectedRoomId(roomId);
  };

  const handleCreateRoom = () => {
    if (!currentUser) return;

    // Tạo phòng bằng cách điều hướng vào board với roomId mới; board sẽ emit join_room và backend tạo room thật.
    const newRoom: RoomListItem = {
      id: `room-${Date.now()}`,
      roomName: `Phòng của ${currentUser.username}`,
      roomCode: createRandomRoomCode(),
      hostName: currentUser.username,
      hostElo: currentUser.elo ?? DEFAULT_ELO,
      players: 1,
      maxPlayers: 2,
      status: "waiting",
    };

    navigateToRoom(newRoom, "create");
  };

  const handleJoinSelectedRoom = () => {
    // Join phòng đang chọn bằng board socket-backed.
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
    // Join nhanh bằng mã hoặc link mời; link được tách code/roomId rồi dò trong snapshot socket hiện tại.
    const joinTarget = parseRoomJoinInput(roomCodeInput);

    if (!joinTarget) {
      alert("Bạn chưa nhập mã phòng hoặc link phòng.");
      return;
    }

    const matchedRoom = rooms.find((room) => {
      return (
        (joinTarget.code &&
          room.roomCode.toUpperCase() === joinTarget.code) ||
        (joinTarget.roomId && room.id === joinTarget.roomId)
      );
    });

    if (!matchedRoom) {
      alert("Không tìm thấy phòng với mã hoặc link này.");
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
                  onChange={(event) => setRoomCodeInput(event.target.value)}
                  onKeyDown={(event) => {
                    //{giải thích code} Cho phép nhấn Enter để vào phòng bằng mã hoặc link.
                    if (event.key === "Enter") {
                      handleJoinByCode();
                    }
                  }}
                  className="room-code-input"
                  placeholder="Nhập mã hoặc link phòng..."
                />

                <button
                  type="button"
                  className="room-code-join-btn"
                  onClick={handleJoinByCode}
                >
                  Vào phòng
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
