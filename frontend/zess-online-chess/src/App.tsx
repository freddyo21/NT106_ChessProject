import { useState } from "react";
import "./App.css";
import LoginUI from "./LoginUI";
import ChessBoard from "./ChessBoard";

function App() {
  const [screen, setScreen] = useState("board");

  return (
    <div>
      {screen === "login" ? (
        <>
          <LoginUI />
          <button onClick={() => setScreen("board")}>Sang bàn cờ</button>
        </>
      ) : (
        <>
          <ChessBoard />
          <button onClick={() => setScreen("login")}>Quay lại đăng nhập</button>
        </>
      )}
    </div>
  );
}

export default App;

/*
import "./App.css";
import ChessBoard from "./ChessBoard";

function App() {
  return <ChessBoard />;
}

export default App;
*/
/*
import "./App.css";
import ChessBoard from "./LoginUI";

function App() {
  return <LoginUI />;
}

export default App;
*/