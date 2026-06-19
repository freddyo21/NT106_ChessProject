import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HttpClient } from "../services/HttpClient";
import "./MatchHistoryPage.css";
import "../Image/PNG_Chess/background.jpg";

type MatchResult = "win" | "loss" | "draw";
type MatchFilter = "all" | MatchResult;
type MatchSide = "white" | "black";

type MatchHistoryItem = {
  id: string;
  playedAt: string;
  opponentName: string;
  result: MatchResult;
  side: MatchSide;
  durationSeconds: number;
};

type MatchHistoryApiItem = {
  gameId: string;
  endedAt: string | null;
  startedAt: string | null;
  opponentUsername: string | null;
  result: MatchResult;
  playerColor: MatchSide;
  durationSeconds: number | null;
};

function getResultLabel(result: MatchResult) {
  switch (result) {
    case "win":
      return "Thắng";
    case "loss":
      return "Thua";
    case "draw":
      return "Hòa";
    default:
      return "";
  }
}

function getSideLabel(side: MatchSide) {
  return side === "white" ? "Trắng" : "Đen";
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function MatchHistoryPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [resultFilter, setResultFilter] = useState<MatchFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedResultFilter, setAppliedResultFilter] = useState<MatchFilter>("all");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMatchHistory() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await HttpClient.get<{ data: { items: MatchHistoryApiItem[] } }>(
          "/match-history/me",
          { params: { page: 1, pageSize: 100 } }
        );

        if (cancelled) return;

        setMatches(response.data.data.items.map((item) => ({
          id: item.gameId,
          playedAt: item.endedAt ?? item.startedAt ?? new Date().toISOString(),
          opponentName: item.opponentUsername ?? "Đối thủ",
          result: item.result,
          side: item.playerColor,
          durationSeconds: Number(item.durationSeconds) || 0,
        })));
      } catch {
        if (!cancelled) {
          setLoadError("Không tải được lịch sử đấu.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMatchHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = () => {
    setAppliedResultFilter(resultFilter);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  };

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const matchDate = new Date(match.playedAt);

      if (appliedResultFilter !== "all" && match.result !== appliedResultFilter) return false;
      if (appliedStartDate && matchDate < new Date(`${appliedStartDate}T00:00:00`)) return false;
      if (appliedEndDate && matchDate > new Date(`${appliedEndDate}T23:59:59`)) return false;

      return true;
    });
  }, [appliedEndDate, appliedResultFilter, appliedStartDate, matches]);

  const statistics = useMemo(() => {
    const total = filteredMatches.length;
    const wins = filteredMatches.filter((match) => match.result === "win").length;
    const losses = filteredMatches.filter((match) => match.result === "loss").length;
    const draws = filteredMatches.filter((match) => match.result === "draw").length;
    const winRate = total === 0 ? 0 : (wins / total) * 100;

    return { total, wins, losses, draws, winRate };
  }, [filteredMatches]);

  const emptyText = isLoading
    ? "Đang tải lịch sử đấu..."
    : loadError || "Chưa có lịch sử trận đấu.";

  return (
    <div className="match-history-page">
      <div className="match-history-shell">
        <div className="match-history-header">
          <button type="button" className="match-history-back-button" onClick={() => navigate("/lobby")}>
            Quay về sảnh
          </button>

          <div>
            <p className="match-history-kicker">PLAYER RECORDS</p>
            <h1>Lịch sử trận đấu</h1>
            <p className="match-history-subtitle">
              Xem lại các trận đã chơi, lọc kết quả và thống kê nhanh hiệu suất thi đấu.
            </p>
          </div>
        </div>

        <section className="match-history-panel match-history-filter-panel">
          <div className="panel-title-row">
            <h2>Bộ lọc trận đấu</h2>
          </div>

          <div className="match-history-filter-grid">
            <label className="field-label">
              Kết quả
              <select
                className="match-history-input"
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value as MatchFilter)}
              >
                <option value="all">Tất cả</option>
                <option value="win">Thắng</option>
                <option value="loss">Thua</option>
                <option value="draw">Hòa</option>
              </select>
            </label>

            <label className="field-label">
              Từ ngày
              <input className="match-history-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>

            <label className="field-label">
              Đến ngày
              <input className="match-history-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>

            <div className="match-history-search-wrap">
              <button type="button" className="primary-btn" onClick={handleSearch}>Tìm kiếm</button>
            </div>
          </div>
        </section>

        <div className="match-history-grid">
          <section className="match-history-panel match-history-stats-panel">
            <div className="panel-title-row">
              <h2>Thống kê</h2>
            </div>

            <div className="match-history-stats-list">
              <div className="match-stat-card"><span className="match-stat-label">Tổng trận</span><strong>{statistics.total}</strong></div>
              <div className="match-stat-card"><span className="match-stat-label">Thắng</span><strong className="stat-win">{statistics.wins}</strong></div>
              <div className="match-stat-card"><span className="match-stat-label">Hòa</span><strong className="stat-draw">{statistics.draws}</strong></div>
              <div className="match-stat-card"><span className="match-stat-label">Thua</span><strong className="stat-loss">{statistics.losses}</strong></div>
              <div className="match-stat-card match-stat-highlight">
                <span className="match-stat-label">Tỷ lệ thắng</span>
                <strong>{statistics.winRate.toFixed(1).replace(".", ",")}%</strong>
              </div>
            </div>
          </section>

          <section className="match-history-panel match-history-table-panel">
            <div className="list-panel-header">
              <div>
                <h2>Danh sách trận đấu</h2>
                <p>{filteredMatches.length} trận hiển thị</p>
              </div>
            </div>

            <div className="match-history-table-wrapper">
              <table className="match-history-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Đối thủ</th>
                    <th>Kết quả</th>
                    <th>Quân</th>
                    <th>Thời lượng</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMatches.length > 0 ? (
                    filteredMatches.map((match) => (
                      <tr key={match.id}>
                        <td>{formatDateTime(match.playedAt)}</td>
                        <td>{match.opponentName}</td>
                        <td><span className={`match-result-badge ${match.result}`}>{getResultLabel(match.result)}</span></td>
                        <td>{getSideLabel(match.side)}</td>
                        <td>{formatDuration(match.durationSeconds)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}><div className="empty-state">{emptyText}</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default MatchHistoryPage;
