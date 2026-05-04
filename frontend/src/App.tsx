import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import LoginUI from "./LoginUI/LoginUI";
import ChessBoardUI from "./ChessBoardUI/ChessBoardUI";
import LobbyPage from "./RoomSystemUI/LobbyPage";
import RoomListPage from "./RoomSystemUI/RoomListPage";
import RoomPage from "./RoomSystemUI/RoomPage";
import LeaderboardPage from "./LeaderboardUI/LeaderboardPage";
import PlayerProfile from "./PlayerProfileUI/PlayerProfile";
import MatchHistoryPage from "./MatchHistoryUI/MatchHistoryPage";

function App() {
  return (
    <div className="app-shell">
      <Routes>
        {/* Mặc định đẩy về Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginUI />} />
        
        {/* Các trang chức năng */}
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/rooms" element={<RoomListPage />} />
        <Route path="/room" element={<RoomPage />} />
        <Route path="/board" element={<ChessBoardUI />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<PlayerProfile />} />
        <Route path="/match-history" element={<MatchHistoryPage />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

export default App;