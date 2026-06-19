import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LeaderboardPage.css";

type LeaderboardPlayer = {
  id: number;
  playerName: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  winRate: number;
  avatarText: string;
  isCurrentUser?: boolean;
};

const leaderboardData: LeaderboardPlayer[] = [];

function LeaderboardPage() {
  const navigate = useNavigate();
  const [players] = useState<LeaderboardPlayer[]>(leaderboardData);
  const [searchKeyword, setSearchKeyword] = useState("");

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.winRate - a.winRate;
    });
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return sortedPlayers.filter((player) =>
      player.playerName.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }, [sortedPlayers, searchKeyword]);

  const topThreePlayers = sortedPlayers.slice(0, 3);

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <button
            type="button"
            className="leaderboard-back-button"
            onClick={() => navigate("/lobby")}
          >
            Quay về sảnh
          </button>

          <div className="leaderboard-header-text">
            <p className="leaderboard-kicker">BẢNG XẾP HẠNG</p>
            <h1>Leaderboard</h1>
            <p className="leaderboard-subtitle">
              Bảng xếp hạng all-time của toàn hệ thống, sắp xếp theo ELO.
            </p>
          </div>
        </div>

        <div className="leaderboard-toolbar">
          <div />

          <input
            type="text"
            className="leaderboard-search-input"
            placeholder="Tìm người chơi..."
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
          />
        </div>

        <div className="leaderboard-top3">
          {topThreePlayers.length === 0 && (
            <div className="leaderboard-empty-state leaderboard-top-empty">
              Chưa có dữ liệu xếp hạng.
            </div>
          )}

          {topThreePlayers.map((player, index) => (
            <div
              key={player.id}
              className={`leaderboard-top-card ${
                index === 0 ? "first" : index === 1 ? "second" : "third"
              }`}
            >
              <div className="leaderboard-top-rank">#{index + 1}</div>
              <div className="leaderboard-top-avatar">{player.avatarText}</div>
              <h3>{player.playerName}</h3>
              <p className="leaderboard-top-elo">{player.elo} ELO</p>

              <div className="leaderboard-top-stats">
                <span>{player.wins} thắng</span>
                <span>{player.losses} thua</span>
                <span>{player.draws} hòa</span>
              </div>

              <p className="leaderboard-top-meta">
                Win rate: {player.winRate.toFixed(2)}% • Tổng trận:{" "}
                {player.totalMatches}
              </p>
            </div>
          ))}
        </div>

        <div className="leaderboard-table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Player Name</th>
                <th>ELO</th>
                <th>Thắng</th>
                <th>Thua</th>
                <th>Hòa</th>
                <th>Win Rate</th>
                <th>Tổng trận</th>
              </tr>
            </thead>

            <tbody>
              {filteredPlayers.map((player, index) => (
                <tr
                  key={player.id}
                  className={player.isCurrentUser ? "current-user-row" : ""}
                >
                  <td className="rank-cell">#{index + 1}</td>
                  <td className="name-cell">
                    <div className="table-player-info">
                      <div className="table-player-avatar">{player.avatarText}</div>
                      <span>{player.playerName}</span>
                      {player.isCurrentUser && <span className="you-badge">Bạn</span>}
                    </div>
                  </td>
                  <td className="elo-cell">{player.elo}</td>
                  <td>{player.wins}</td>
                  <td>{player.losses}</td>
                  <td>{player.draws}</td>
                  <td className="winrate-cell">{player.winRate.toFixed(2)}%</td>
                  <td>{player.totalMatches}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPlayers.length === 0 && (
            <div className="leaderboard-empty-state">
              Chưa có người chơi nào trong bảng xếp hạng.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LeaderboardPage;
