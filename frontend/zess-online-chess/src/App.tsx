import { useState } from "react";
import "./App.css";
import LoginUI from "./LoginUI/LoginUI";
import ChessBoard from "./ChessBoardUI/ChessBoardUI";
import LobbyPage from "./RoomSystemUI/LobbyPage";
import RoomPage from "./RoomSystemUI/RoomPage";

type Screen = "login" | "lobby" | "room" | "board";

function App() {
  const [screen, setScreen] = useState<Screen>("login");

  return (
    <div className="app-shell">
      {screen === "login" && (
        <LoginUI onLoginSuccess={() => setScreen("lobby")} />
      )}

      {screen === "lobby" && (
        <LobbyPage
          onCreateRoom={() => setScreen("room")}
          onJoinRoom={() => setScreen("room")}
        />
      )}

      {screen === "room" && (
        <RoomPage
          onBackToLobby={() => setScreen("lobby")}
          onStartGame={() => setScreen("board")}
        />
      )}

      {screen === "board" && <ChessBoard />}
    </div>
  );
}

export default App;