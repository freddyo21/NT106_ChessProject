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

const mockLeaderboardData: LeaderboardPlayer[] = [
  {
    id: 1,
    playerName: "LyNa",
    elo: 1842,
    wins: 52,
    losses: 8,
    draws: 10,
    totalMatches: 70,
    winRate: 74.29,
    avatarText: "LN",
  },
  {
    id: 2,
    playerName: "Ngoc",
    elo: 1796,
    wins: 46,
    losses: 12,
    draws: 8,
    totalMatches: 66,
    winRate: 69.7,
    avatarText: "NG",
  },
  {
    id: 3,
    playerName: "DuyAnh",
    elo: 1768,
    wins: 42,
    losses: 11,
    draws: 9,
    totalMatches: 62,
    winRate: 67.74,
    avatarText: "DA",
  },
  {
    id: 4,
    playerName: "MH",
    elo: 1715,
    wins: 39,
    losses: 15,
    draws: 6,
    totalMatches: 60,
    winRate: 65,
    avatarText: "MH",
    isCurrentUser: true,
  },
  {
    id: 5,
    playerName: "Bao",
    elo: 1664,
    wins: 31,
    losses: 18,
    draws: 7,
    totalMatches: 56,
    winRate: 55.36,
    avatarText: "BA",
  },
  {
    id: 6,
    playerName: "Khanh",
    elo: 1648,
    wins: 29,
    losses: 17,
    draws: 10,
    totalMatches: 56,
    winRate: 51.79,
    avatarText: "KH",
  },
  {
    id: 7,
    playerName: "Minh",
    elo: 1599,
    wins: 24,
    losses: 20,
    draws: 8,
    totalMatches: 52,
    winRate: 46.15,
    avatarText: "MI",
  },
  {
    id: 8,
    playerName: "Hieu",
    elo: 1540,
    wins: 20,
    losses: 23,
    draws: 9,
    totalMatches: 52,
    winRate: 38.46,
    avatarText: "HI",
  },
];

function LeaderboardPage() {
  const navigate = useNavigate();

  //{giải thích code} Tạm dùng mock data để dựng UI trước.
  //{giải thích code} Khi nối API hoặc socket, đổi lại thành:
  //{giải thích code} const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [players] = useState<LeaderboardPlayer[]>(mockLeaderboardData);

  //{giải thích code} Dùng để tìm nhanh người chơi khi danh sách dài hơn.
  const [searchKeyword, setSearchKeyword] = useState("");

  const sortedPlayers = useMemo(() => {
    //{giải thích code} Leaderboard ưu tiên sort theo ELO giảm dần.
    //{giải thích code} Nếu ELO bằng nhau thì so tiếp số trận thắng rồi đến win rate.
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
            className="leaderboard-back-button"
            onClick={() => navigate("/lobby")}
          >
            ← Quay lại
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
                Win rate: {player.winRate.toFixed(2)}% • Tổng trận: {player.totalMatches}
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

                      {player.isCurrentUser && (
                        <span className="you-badge">Bạn</span>
                      )}
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
        </div>
      </div>
    </div>
  );
}

export default LeaderboardPage;