import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./MatchHistoryPage.css";
import "../Image/PNG_Chess/background.jpg"
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

//{giải thích code} Dữ liệu demo để dựng UI trước, sau này backend trả data thật thì thay mảng này bằng API.
const DEMO_MATCHES: MatchHistoryItem[] = [
  {
    id: "M001",
    playedAt: "2026-04-13T19:25:00",
    opponentName: "LyNa",
    result: "win",
    side: "white",
    durationSeconds: 925,
  },
  {
    id: "M002",
    playedAt: "2026-04-12T21:10:00",
    opponentName: "DuyAnh",
    result: "loss",
    side: "black",
    durationSeconds: 1234,
  },
  {
    id: "M003",
    playedAt: "2026-04-11T15:40:00",
    opponentName: "Ngoc",
    result: "draw",
    side: "white",
    durationSeconds: 845,
  },
  {
    id: "M004",
    playedAt: "2026-04-10T08:05:00",
    opponentName: "Guest_102",
    result: "win",
    side: "black",
    durationSeconds: 612,
  },
  {
    id: "M005",
    playedAt: "2026-04-09T22:30:00",
    opponentName: "MasterPawn",
    result: "loss",
    side: "white",
    durationSeconds: 1408,
  },
  {
    id: "M006",
    playedAt: "2026-04-08T17:55:00",
    opponentName: "BlueKnight",
    result: "win",
    side: "black",
    durationSeconds: 488,
  },
  {
    id: "M007",
    playedAt: "2026-04-07T13:20:00",
    opponentName: "NoobKing",
    result: "draw",
    side: "white",
    durationSeconds: 1010,
  },
  {
    id: "M008",
    playedAt: "2026-04-06T10:50:00",
    opponentName: "QueenRush",
    result: "win",
    side: "white",
    durationSeconds: 734,
  },
];

function getResultLabel(result: MatchResult) {
  //{giải thích code} Đổi giá trị kỹ thuật thành nhãn tiếng Việt để hiển thị UI.
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
  //{giải thích code} Hiển thị màu quân người chơi đã cầm trong trận.
  return side === "white" ? "Trắng" : "Đen";
}

function formatDateTime(dateString: string) {
  //{giải thích code} Format ngày giờ theo kiểu Việt Nam.
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
  //{giải thích code} Chuyển tổng số giây thành chuỗi dễ đọc.
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function MatchHistoryPage() {
  const navigate = useNavigate();

  //{giải thích code} State nhập liệu ở khu vực bộ lọc.
  const [resultFilter, setResultFilter] = useState<MatchFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  //{giải thích code} Chỉ áp dụng lọc khi user bấm nút tìm kiếm.
  const [appliedResultFilter, setAppliedResultFilter] =
    useState<MatchFilter>("all");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const handleSearch = () => {
    //{giải thích code} Đồng bộ bộ lọc nhập tay sang bộ lọc áp dụng thật.
    setAppliedResultFilter(resultFilter);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  };

  const filteredMatches = useMemo(() => {
    //{giải thích code} Lọc danh sách trận theo kết quả và khoảng thời gian.
    return DEMO_MATCHES.filter((match) => {
      const matchDate = new Date(match.playedAt);

      if (
        appliedResultFilter !== "all" &&
        match.result !== appliedResultFilter
      ) {
        return false;
      }

      if (appliedStartDate) {
        const start = new Date(`${appliedStartDate}T00:00:00`);
        if (matchDate < start) {
          return false;
        }
      }

      if (appliedEndDate) {
        const end = new Date(`${appliedEndDate}T23:59:59`);
        if (matchDate > end) {
          return false;
        }
      }

      return true;
    });
  }, [appliedEndDate, appliedResultFilter, appliedStartDate]);

  const statistics = useMemo(() => {
    //{giải thích code} Tính thống kê dựa trên danh sách sau khi đã lọc.
    const total = filteredMatches.length;
    const wins = filteredMatches.filter((match) => match.result === "win").length;
    const losses = filteredMatches.filter((match) => match.result === "loss").length;
    const draws = filteredMatches.filter((match) => match.result === "draw").length;
    const winRate = total === 0 ? 0 : (wins / total) * 100;

    return {
      total,
      wins,
      losses,
      draws,
      winRate,
    };
  }, [filteredMatches]);

  return (
    <div className="match-history-page">
      <div className="match-history-shell">
        <div className="match-history-header">
          <div>
            <p className="match-history-kicker">PLAYER RECORDS</p>
            <h1>Lịch sử trận đấu</h1>
            <p className="match-history-subtitle">
              Xem lại các trận đã chơi, lọc kết quả và thống kê nhanh hiệu suất thi đấu.
            </p>
          </div>

          <div className="match-history-header-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => navigate("/lobby")}
            >
              Quay về sảnh
            </button>
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
                onChange={(event) =>
                  setResultFilter(event.target.value as MatchFilter)
                }
              >
                <option value="all">Tất cả</option>
                <option value="win">Thắng</option>
                <option value="loss">Thua</option>
                <option value="draw">Hòa</option>
              </select>
            </label>

            <label className="field-label">
              Từ ngày
              <input
                className="match-history-input"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label className="field-label">
              Đến ngày
              <input
                className="match-history-input"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>

            <div className="match-history-search-wrap">
              <button
                type="button"
                className="primary-btn"
                onClick={handleSearch}
              >
                Tìm kiếm
              </button>
            </div>
          </div>
        </section>

        <div className="match-history-grid">
          <section className="match-history-panel match-history-stats-panel">
            <div className="panel-title-row">
              <h2>Thống kê</h2>
            </div>

            <div className="match-history-stats-list">
              <div className="match-stat-card">
                <span className="match-stat-label">Tổng trận</span>
                <strong>{statistics.total}</strong>
              </div>

              <div className="match-stat-card">
                <span className="match-stat-label">Thắng</span>
                <strong className="stat-win">{statistics.wins}</strong>
              </div>

              <div className="match-stat-card">
                <span className="match-stat-label">Hòa</span>
                <strong className="stat-draw">{statistics.draws}</strong>
              </div>

              <div className="match-stat-card">
                <span className="match-stat-label">Thua</span>
                <strong className="stat-loss">{statistics.losses}</strong>
              </div>

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
                        <td>
                          <span className={`match-result-badge ${match.result}`}>
                            {getResultLabel(match.result)}
                          </span>
                        </td>
                        <td>{getSideLabel(match.side)}</td>
                        <td>{formatDuration(match.durationSeconds)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          Không có trận nào phù hợp với bộ lọc hiện tại.
                        </div>
                      </td>
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