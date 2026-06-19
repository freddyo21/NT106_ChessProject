import "./PlayerInfoUI.css";

export type PlayerInfo = {
  name: string;
  color: "white" | "black";
  elo?: number;
  status?: string;
  avatarText?: string;
  online?: boolean;
};

interface PlayerInfoUIProps {
  player: PlayerInfo;
  isActive?: boolean;
}

function PlayerInfoUI({ player, isActive = false }: PlayerInfoUIProps) {
  //{Đổi màu quân thành text tiếng Việt để hiển thị}
  const colorLabel = player.color === "white" ? "Trắng" : "Đen";

  //{Nếu không có avatarText thì lấy chữ cái đầu của tên}
  const avatarFallback = player.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`player-info-card ${isActive ? "active" : ""}`}>
      <div className="player-info-left">
        <div
          className={`player-info-avatar ${
            player.color === "white" ? "self" : "enemy"
          }`}
        >
          {player.avatarText || avatarFallback}
        </div>

        <div className="player-info-text">
          <p className="player-info-name">{player.name}</p>
          <p className="player-info-meta">
            {colorLabel}
            {player.elo ? ` • ELO ${player.elo}` : ""}
            {player.status ? ` • ${player.status}` : ""}
          </p>
        </div>
      </div>

      <div className="player-info-right">
        <span
          className={`player-info-dot ${player.online ? "online" : "offline"}`}
        ></span>
        <span className="player-info-online-text">
          {player.online ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}

export default PlayerInfoUI;