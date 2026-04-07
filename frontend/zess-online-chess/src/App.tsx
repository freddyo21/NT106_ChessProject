import { useState } from "react";
import "./App.css";
import LoginUI from "./LoginUI/LoginUI";
import ChessBoard from "./ChessBoard/ChessBoard";

function App() {
  const [screen, setScreen] = useState("login");

  return (
    <div>
      {screen === "login" ? (
        <LoginUI onLoginSuccess={() => setScreen("board")} />
      ) : (
        <ChessBoard />
      )}
    </div>
  );
}

export default App;