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
  //{giáº£i thĂ­ch code} Sinh mĂ£ phĂ²ng demo; sau nĂ y backend cĂ³ thá»ƒ tráº£ roomCode tháº­t thay vĂ¬ frontend tá»± táº¡o.
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < 6; i += 1) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
}

function normalizeRoomCode(value: string) {
  //{giáº£i thĂ­ch code} Chuáº©n hĂ³a mĂ£ phĂ²ng Ä‘á»ƒ trĂ¡nh lá»—i do viáº¿t thÆ°á»ng hoáº·c dÆ° khoáº£ng tráº¯ng.
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
  //{giáº£i thĂ­ch code} Chuyá»ƒn tráº¡ng thĂ¡i ká»¹ thuáº­t sang chá»¯ tiáº¿ng Viá»‡t Ä‘á»ƒ hiá»ƒn thá»‹ trĂªn UI.
  if (status === "waiting") return "Äang chá»";
  if (status === "playing") return "Äang Ä‘áº¥u";
  return "ÄĂ£ Ä‘áº§y";
}

function getStatusClass(status: RoomStatus) {
  //{giáº£i thĂ­ch code} Tráº£ class CSS riĂªng cho tá»«ng tráº¡ng thĂ¡i phĂ²ng.
  if (status === "waiting") return "waiting";
  if (status === "playing") return "playing";
  return "full";
}

function canJoinRoom(room?: RoomListItem) {
  //{giáº£i thĂ­ch code} Chá»‰ cho vĂ o phĂ²ng Ä‘ang chá» vĂ  cĂ²n slot; khĂ´ng cĂ³ spectate nĂªn phĂ²ng Ä‘ang Ä‘áº¥u/Ä‘Ă£ Ä‘áº§y bá»‹ khĂ³a.
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
      // Danh sĂ¡ch phĂ²ng láº¥y tá»« room-management socket, khĂ´ng dĂ¹ng mock local ná»¯a.
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
    //{giáº£i thĂ­ch code} Lá»c danh sĂ¡ch phĂ²ng theo tĂªn phĂ²ng hoáº·c tĂªn chá»§ phĂ²ng.
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
    //{giáº£i thĂ­ch code} Láº¥y phĂ²ng Ä‘ang Ä‘Æ°á»£c chá»n Ä‘á»ƒ quyáº¿t Ä‘á»‹nh nĂºt "VĂ o phĂ²ng" cĂ³ Ä‘Æ°á»£c báº¥m hay khĂ´ng.
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
    //{giáº£i thĂ­ch code} Quay vá» Lobby chĂ­nh.
    navigate("/lobby");
  };

  const handleRefreshRooms = () => {
    const socket = getAppSocket();

    // Chá»§ Ä‘á»™ng request snapshot má»›i tá»« backend socket.
    socket?.emit("rooms:list", (nextRooms) => {
      setRooms(nextRooms);
    });
  };

  const handleSelectRoom = (roomId: string) => {
    //{giáº£i thĂ­ch code} LÆ°u phĂ²ng Ä‘ang chá»n Ä‘á»ƒ ngÆ°á»i dĂ¹ng cĂ³ thá»ƒ báº¥m nĂºt "VĂ o phĂ²ng".
    setSelectedRoomId(roomId);
  };

  const handleCreateRoom = () => {
    if (!currentUser) return;

    // Táº¡o phĂ²ng báº±ng cĂ¡ch Ä‘iá»u hÆ°á»›ng vĂ o board vá»›i roomId má»›i; board sáº½ emit join_room vĂ  backend táº¡o room tháº­t.
    const newRoom: RoomListItem = {
      id: `room-${Date.now()}`,
      roomName: `PhĂ²ng cá»§a ${currentUser.username}`,
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
    // Join phĂ²ng Ä‘ang chá»n báº±ng board socket-backed.
    if (!selectedRoom) {
      alert("Báº¡n chÆ°a chá»n phĂ²ng.");
      return;
    }

    if (!canJoinRoom(selectedRoom)) {
      alert("PhĂ²ng nĂ y khĂ´ng thá»ƒ vĂ o vĂ¬ Ä‘Ă£ Ä‘áº§y hoáº·c Ä‘ang Ä‘áº¥u.");
      return;
    }

    navigateToRoom(selectedRoom, "join");
  };

  const handleJoinByCode = () => {
    // Join nhanh báº±ng mĂ£ hoáº·c link má»i; link Ä‘Æ°á»£c tĂ¡ch code/roomId rá»“i dĂ² trong snapshot socket hiá»‡n táº¡i.
    const joinTarget = parseRoomJoinInput(roomCodeInput);

    if (!joinTarget) {
      alert("Báº¡n chÆ°a nháº­p mĂ£ phĂ²ng hoáº·c link phĂ²ng.");
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
      alert("KhĂ´ng tĂ¬m tháº¥y phĂ²ng vá»›i mĂ£ hoáº·c link nĂ y.");
      return;
    }

    if (!canJoinRoom(matchedRoom)) {
      alert("PhĂ²ng nĂ y khĂ´ng thá»ƒ vĂ o vĂ¬ Ä‘Ă£ Ä‘áº§y hoáº·c Ä‘ang Ä‘áº¥u.");
      return;
    }

    navigateToRoom(matchedRoom, "join");
  };

  const handleDoubleClickRoom = (room: RoomListItem) => {
    //{giáº£i thĂ­ch code} Cho phĂ©p double click vĂ o phĂ²ng Ä‘ang chá» Ä‘á»ƒ vĂ o nhanh.
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
            aria-label="Quay vá» Lobby"
          >
            <img src={logoImage} alt="Zess Online Chess Logo" />
          </button>

          <div className="room-list-heading">
            <p>ZESS ONLINE CHESS</p>
            <h1>Danh sĂ¡ch phĂ²ng</h1>
          </div>
        </header>

        <main className="room-list-main">
          <section className="room-list-panel">
            <div className="room-list-toolbar">
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                className="room-list-search"
                placeholder="TĂ¬m theo tĂªn phĂ²ng hoáº·c chá»§ phĂ²ng..."
              />

              <div className="room-code-join-box">
                <input
                  value={roomCodeInput}
                  onChange={(event) => setRoomCodeInput(event.target.value)}
                  onKeyDown={(event) => {
                    //{giáº£i thĂ­ch code} Cho phĂ©p nháº¥n Enter Ä‘á»ƒ vĂ o phĂ²ng báº±ng mĂ£ hoáº·c link.
                    if (event.key === "Enter") {
                      handleJoinByCode();
                    }
                  }}
                  className="room-code-input"
                  placeholder="Nháº­p mĂ£ hoáº·c link phĂ²ng..."
                />

                <button
                  type="button"
                  className="room-code-join-btn"
                  onClick={handleJoinByCode}
                >
                  VĂ o phĂ²ng
                </button>
              </div>
            </div>

            <div className="room-list-table-wrap">
              <table className="room-list-table">
                <thead>
                  <tr>
                    <th>TĂªn phĂ²ng</th>
                    <th>Chá»§ phĂ²ng</th>
                    <th>Elo</th>
                    <th>NgÆ°á»i</th>
                    <th>Tráº¡ng thĂ¡i</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRooms.length === 0 ? (
                    <tr>
                      <td className="room-list-empty" colSpan={5}>
                        KhĂ´ng tĂ¬m tháº¥y phĂ²ng phĂ¹ há»£p.
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
                LĂ m má»›i
              </button>

              <button
                type="button"
                className="room-list-action-btn primary"
                onClick={handleCreateRoom}
              >
                Táº¡o phĂ²ng má»›i
              </button>

              <button
                type="button"
                className="room-list-action-btn back"
                onClick={handleBackToLobby}
              >
                Quay vá» sáº£nh
              </button>

              <button
                type="button"
                className="room-list-action-btn join"
                onClick={handleJoinSelectedRoom}
                disabled={isJoinButtonDisabled}
                title={
                  isJoinButtonDisabled
                    ? "Chá»‰ cĂ³ thá»ƒ vĂ o phĂ²ng Ä‘ang chá» vĂ  cĂ²n slot"
                    : "VĂ o phĂ²ng Ä‘Ă£ chá»n"
                }
              >
                VĂ o phĂ²ng
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default RoomListPage;
