import "./OnlinePlayers.css";
import { getRankByElo, EloRankDivision, EloRankTier } from "@zess-online-chess/shared";
import BronzeBadge from "../Image/PNG_BadgeRank/Bronze.svg";
import GoldBadge from "../Image/PNG_BadgeRank/Gold.svg";
import MasterBadge from "../Image/PNG_BadgeRank/Master.svg";
import SilverBadge from "../Image/PNG_BadgeRank/Siver.svg";

export type OnlinePlayerStatus = "online" | "playing" | "idle";

export type OnlinePlayerRankTier = EloRankTier;

export type OnlinePlayerRankDivision = EloRankDivision;

export type OnlinePlayer = {
  id: string;
  displayName: string;
  elo: number;
  status: OnlinePlayerStatus;
  subtitle?: string;
  activityText?: string;
  avatarUrl?: string;
  rankTier?: OnlinePlayerRankTier;
  rankText?: string;
};

type OnlinePlayersProps = {
  players: OnlinePlayer[];
};

function getAvatarText(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }

  return displayName.slice(0, 2).toUpperCase();
}

function getRankBadgeSrc(rankTier: OnlinePlayerRankTier) {
  switch (rankTier) {
    case "bronze":
      return BronzeBadge;

    case "silver":
      return SilverBadge;

    case "gold":
      return GoldBadge;

    case "master":
      return MasterBadge;

    default:
      return null;
  }
}

function getStatusText(status: OnlinePlayerStatus) {
  switch (status) {
    case "online":
      return "Đang online";

    case "playing":
      return "Đang đấu";

    case "idle":
      return "Đang chờ";

    default:
      return "Không rõ trạng thái";
  }
}

function OnlinePlayers({ players }: OnlinePlayersProps) {
  return (
    <div className="op-panel">
      <div className="op-header">
        <span className="op-kicker">User Online</span>
        <span className="op-count" title={`${players.length} người chơi online`}>
          {players.length}
        </span>
      </div>

      <div className="op-list">
        {players.length > 0 ? (
          players.map((player) => {
            const resolvedRank = getRankByElo(player.elo);
            const rankBadgeSrc = getRankBadgeSrc(resolvedRank.tier);

            const metaText = `Elo ${player.elo}${
              player.subtitle ? ` Â· ${player.subtitle}` : ""
            }`;

            return (
              <div
                className="op-card"
                key={player.id}
                title={`${player.displayName} Â· ${resolvedRank.text} Â· ${getStatusText(
                  player.status
                )}`}
              >
                <div className="op-avatar-wrap">
                  {player.avatarUrl ? (
                    <img
                      className="op-avatar-img"
                      src={player.avatarUrl}
                      alt={player.displayName}
                    />
                  ) : (
                    <div className="op-avatar">
                      {getAvatarText(player.displayName)}
                    </div>
                  )}

                  <span
                    className={`op-dot op-dot--${player.status}`}
                    title={getStatusText(player.status)}
                  />
                </div>

                <div className="op-info">
                  <div className="op-name-row">
                    <span className="op-name" title={player.displayName}>
                      {player.displayName}
                    </span>

                    {rankBadgeSrc && (
                      <img
                        src={rankBadgeSrc}
                        alt={resolvedRank.text}
                        title={resolvedRank.text}
                        className="op-rank-badge"
                      />
                    )}

                    <span className="op-rank-text" title={resolvedRank.text}>
                      {resolvedRank.text}
                    </span>
                  </div>

                  <span className="op-meta" title={metaText}>
                    {metaText}
                  </span>
                </div>

                <span
                  className={`op-status-pill op-status-pill--${player.status}`}
                  title={getStatusText(player.status)}
                >
                  {getStatusText(player.status)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="op-empty">Chưa có người chơi nào online.</div>
        )}
      </div>
    </div>
  );
}

export default OnlinePlayers;
