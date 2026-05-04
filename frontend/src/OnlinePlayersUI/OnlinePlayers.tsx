import "./OnlinePlayers.css";
import BronzeBadge from "../Image/PNG_BadgeRank/Bronze.svg";
import GoldBadge from "../Image/PNG_BadgeRank/Gold.svg";
import MasterBadge from "../Image/PNG_BadgeRank/Master.svg";
import SilverBadge from "../Image/PNG_BadgeRank/Siver.svg";

export type OnlinePlayerStatus = "online" | "playing" | "idle";

export type OnlinePlayerRankTier = "bronze" | "silver" | "gold" | "master";

export type OnlinePlayerRankDivision = 1 | 2 | 3;

export type OnlinePlayer = {
  id: string;
  displayName: string;
  elo: number;
  status: OnlinePlayerStatus;
  subtitle?: string;
  activityText?: string;
  avatarUrl?: string;

  //{giải thích code} Giữ lại để sau này backend có thể trả rank nếu cần, nhưng hiện tại UI sẽ tự tính theo Elo.
  rankTier?: OnlinePlayerRankTier;
  rankText?: string;
};

type OnlinePlayersProps = {
  players: OnlinePlayer[];
  onInvitePlayer?: (player: OnlinePlayer) => void;
};

type ResolvedPlayerRank = {
  tier: OnlinePlayerRankTier;
  division: OnlinePlayerRankDivision;
  text: string;
};

function getAvatarText(displayName: string) {
  //{giải thích code} Lấy 2 ký tự đầu làm avatar nếu người chơi chưa có ảnh đại diện.
  const words = displayName.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }

  return displayName.slice(0, 2).toUpperCase();
}

function getRankByElo(elo: number): ResolvedPlayerRank {
  //{giải thích code} Quy đổi Elo sang rank theo hệ Đồng/Bạc/Vàng/Master, mỗi nhóm có bậc III/II/I.
  if (elo >= 2100) {
    return {
      tier: "master",
      division: 1,
      text: "Master I",
    };
  }

  if (elo >= 2000) {
    return {
      tier: "master",
      division: 2,
      text: "Master II",
    };
  }

  if (elo >= 1900) {
    return {
      tier: "master",
      division: 3,
      text: "Master III",
    };
  }

  if (elo >= 1800) {
    return {
      tier: "gold",
      division: 1,
      text: "Vàng I",
    };
  }

  if (elo >= 1700) {
    return {
      tier: "gold",
      division: 2,
      text: "Vàng II",
    };
  }

  if (elo >= 1600) {
    return {
      tier: "gold",
      division: 3,
      text: "Vàng III",
    };
  }

  if (elo >= 1500) {
    return {
      tier: "silver",
      division: 1,
      text: "Bạc I",
    };
  }

  if (elo >= 1400) {
    return {
      tier: "silver",
      division: 2,
      text: "Bạc II",
    };
  }

  if (elo >= 1300) {
    return {
      tier: "silver",
      division: 3,
      text: "Bạc III",
    };
  }

  if (elo >= 1200) {
    return {
      tier: "bronze",
      division: 1,
      text: "Đồng I",
    };
  }

  if (elo >= 1100) {
    return {
      tier: "bronze",
      division: 2,
      text: "Đồng II",
    };
  }

  return {
    tier: "bronze",
    division: 3,
    text: "Đồng III",
  };
}

function getRankBadgeSrc(rankTier: OnlinePlayerRankTier) {
  //{giải thích code} Hiện tại mỗi nhóm rank dùng 1 badge đại diện, bậc I/II/III hiển thị bằng chữ bên cạnh.
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
  //{giải thích code} Chuyển status kỹ thuật thành text dễ hiểu cho tooltip.
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

function OnlinePlayers({ players, onInvitePlayer }: OnlinePlayersProps) {
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
            //{giải thích code} Nếu người chơi đang trong ván thì không cho gửi lời mời đấu.
            const isBusy = player.status === "playing";

            //{giải thích code} Rank hiện tại được tính trực tiếp từ Elo để tránh mock thủ công sai logic.
            const resolvedRank = getRankByElo(player.elo);
            const rankBadgeSrc = getRankBadgeSrc(resolvedRank.tier);

            const metaText = `Elo ${player.elo}${
              player.subtitle ? ` · ${player.subtitle}` : ""
            }`;

            return (
              <div
                className="op-card"
                key={player.id}
                title={`${player.displayName} · ${resolvedRank.text} · ${getStatusText(
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

                <button
                  type="button"
                  className="op-btn"
                  onClick={() => onInvitePlayer?.(player)}
                  disabled={isBusy}
                  title={
                    isBusy
                      ? `${player.displayName} đang trong ván đấu`
                      : `Mời ${player.displayName} đấu cờ`
                  }
                >
                  {isBusy ? "Đang đấu" : "Mời đấu"}
                </button>
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