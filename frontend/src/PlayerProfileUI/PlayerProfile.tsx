import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_ELO, ERoles } from "@zess-online-chess/shared";
import { HttpClient } from "../services/HttpClient";
import {
  getCurrentUser,
  getUserDisplayName,
  updateAuthSessionUser,
  type AuthSessionUser,
} from "../services/authSession";
import { userChangePassword } from "../services/auth.services";
import { getAppSocket, type PlayerProfileStatsPayload } from "../services/socketClient";
import "./PlayerProfile.css";

type PlayerProfileStats = {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number;
};

type PlayerProfileStatsResponse = {
  data: PlayerProfileStatsPayload;
};

function getFallbackUser(): AuthSessionUser {
  return {
    id: "current-user",
    email: "",
    name: "Người chơi",
    username: "player",
    elo: DEFAULT_ELO,
    role: ERoles.GUEST,
    status: "active",
    isVerified: false,
  };
}

function getAvatarText(displayName: string, username: string) {
  const trimmedDisplayName = displayName.trim();

  if (trimmedDisplayName) {
    const words = trimmedDisplayName.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
      return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
    }

    return trimmedDisplayName.slice(0, 2).toUpperCase();
  }

  return username.slice(0, 2).toUpperCase();
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    return response?.data?.message || response?.data?.error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
}

function mapStatsPayload(payload: PlayerProfileStatsPayload): PlayerProfileStats {
  return {
    elo: Number(payload.rating) || DEFAULT_ELO,
    wins: Number(payload.wins) || 0,
    losses: Number(payload.losses) || 0,
    draws: Number(payload.draws) || 0,
    gamesPlayed: Number(payload.gamesPlayed) || 0,
    winRate: Number(payload.winRate) || 0,
  };
}

function PlayerProfile() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<AuthSessionUser>(() =>
    getCurrentUser() ?? getFallbackUser()
  );
  const [profileStats, setProfileStats] = useState<PlayerProfileStats>(() => ({
    elo: currentUser.elo ?? DEFAULT_ELO,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesPlayed: 0,
    winRate: 0,
  }));

  const [editedDisplayName, setEditedDisplayName] = useState(
    getUserDisplayName(currentUser)
  );
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const displayName = getUserDisplayName(currentUser);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileStats() {
      try {
        const response = await HttpClient.get<PlayerProfileStatsResponse>("/leaderboard/me");
        if (cancelled) return;

        const nextStats = mapStatsPayload(response.data.data);
        setProfileStats(nextStats);
        setCurrentUser((prevUser) => {
          const updatedUser = { ...prevUser, elo: nextStats.elo };
          updateAuthSessionUser(updatedUser);
          return updatedUser;
        });
      } catch {
        // Keep the session fallback visible if stats cannot be loaded.
      }
    }

    loadProfileStats();

    const socket = getAppSocket();
    const handleStatsUpdated = (payload: PlayerProfileStatsPayload) => {
      if (payload.userId !== currentUser.id) return;

      const nextStats = mapStatsPayload(payload);
      setProfileStats(nextStats);
      setCurrentUser((prevUser) => {
        const updatedUser = { ...prevUser, elo: nextStats.elo };
        updateAuthSessionUser(updatedUser);
        return updatedUser;
      });
    };

    socket?.on("profile:stats_updated", handleStatsUpdated);
    if (socket && !socket.connected) {
      socket.connect();
    }

    return () => {
      cancelled = true;
      socket?.off("profile:stats_updated", handleStatsUpdated);
    };
  }, [currentUser.id]);

  const avatarText = useMemo(() => {
    return getAvatarText(displayName, currentUser.username);
  }, [displayName, currentUser.username]);

  const totalGames = useMemo(() => {
    return profileStats.gamesPlayed || profileStats.wins + profileStats.losses + profileStats.draws;
  }, [profileStats]);

  const winRate = useMemo(() => {
    return profileStats.winRate;
  }, [profileStats.winRate]);

  const profileStatCards = useMemo(() => {
    return [
      { label: "Elo", value: profileStats.elo.toString() },
      { label: "Thắng", value: profileStats.wins.toString() },
      { label: "Thua", value: profileStats.losses.toString() },
      { label: "Hòa", value: profileStats.draws.toString() },
      { label: "Tổng trận", value: totalGames.toString() },
      { label: "Win rate", value: `${winRate}%` },
    ];
  }, [profileStats, totalGames, winRate]);

  const hasProfileStats = totalGames > 0 || profileStats.elo > 0;

  const handleGoBack = () => {
    navigate("/lobby");
  };

  const handleSaveDisplayName = () => {
    const normalizedDisplayName = editedDisplayName.trim();

    if (!normalizedDisplayName) {
      alert("Tên hiển thị không được để trống.");
      return;
    }

    if (normalizedDisplayName.length < 2) {
      alert("Tên hiển thị phải có ít nhất 2 ký tự.");
      return;
    }

    const updatedUser: AuthSessionUser = {
      ...currentUser,
      name: normalizedDisplayName,
    };

    // Auth branch currently gives the UI user info through the session payload; keep this local copy in sync.
    setCurrentUser(updatedUser);
    updateAuthSessionUser(updatedUser);
    alert("Đã cập nhật tên hiển thị trên phiên hiện tại.");
  };

  const handleUpdatePassword = async () => {
    if (
      !currentPasswordInput.trim() ||
      !newPasswordInput.trim() ||
      !confirmNewPasswordInput.trim()
    ) {
      alert("Vui lòng nhập đầy đủ các trường mật khẩu.");
      return;
    }

    if (newPasswordInput.length < 8) {
      alert("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      alert("Xác nhận mật khẩu chưa khớp.");
      return;
    }

    setIsChangingPassword(true);

    try {
      await userChangePassword({
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
        confirmPassword: confirmNewPasswordInput,
      });

      alert("Đã cập nhật mật khẩu.");
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmNewPasswordInput("");
    } catch (error) {
      alert(getErrorMessage(error) || "Không thể cập nhật mật khẩu.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="player-profile-page">
      <div className="player-profile-shell">
        <div className="player-profile-topbar">
          <button
            type="button"
            className="profile-back-btn"
            onClick={handleGoBack}
          >
            ← Quay lại Lobby
          </button>
        </div>

        <section className="player-profile-hero">
          <div className="player-profile-avatar">{avatarText}</div>

          <div className="player-profile-main-info">
            <p className="player-profile-kicker">PLAYER PROFILE</p>
            <h1>{displayName}</h1>
            <p className="player-profile-username">@{currentUser.username}</p>
            <p className="player-profile-elo">
              Elo hiện tại: <strong>{profileStats.elo}</strong>
            </p>
          </div>
        </section>

        <section className="player-profile-panel">
          <div className="player-profile-panel-header">
            <h2>Thống kê thi đấu</h2>
          </div>

          {hasProfileStats ? (
            <div className="player-profile-stats-grid">
              {profileStatCards.map((statCard) => (
                <div className="player-profile-stat-card" key={statCard.label}>
                  <p className="player-profile-stat-value">{statCard.value}</p>
                  <p className="player-profile-stat-label">{statCard.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="player-profile-empty-state">
              Chưa có dữ liệu thống kê thi đấu.
            </div>
          )}
        </section>

        <div className="player-profile-edit-grid">
          <section className="player-profile-panel">
            <div className="player-profile-panel-header">
              <h2>Chỉnh sửa tên hiển thị</h2>
            </div>

            <label className="profile-field-label">Tên hiển thị mới</label>
            <input
              className="profile-input"
              type="text"
              placeholder="Nhập tên hiển thị mới"
              value={editedDisplayName}
              onChange={(event) => setEditedDisplayName(event.target.value)}
            />

            <button
              type="button"
              className="profile-primary-btn profile-full-btn"
              onClick={handleSaveDisplayName}
            >
              Lưu tên hiển thị
            </button>
          </section>

          <section className="player-profile-panel">
            <div className="player-profile-panel-header">
              <h2>Thiết lập lại mật khẩu</h2>
            </div>

            <label className="profile-field-label">Mật khẩu hiện tại</label>
            <input
              className="profile-input"
              type="password"
              placeholder="Nhập mật khẩu hiện tại"
              value={currentPasswordInput}
              onChange={(event) => setCurrentPasswordInput(event.target.value)}
            />

            <label className="profile-field-label">Mật khẩu mới</label>
            <input
              className="profile-input"
              type="password"
              placeholder="Nhập mật khẩu mới"
              value={newPasswordInput}
              onChange={(event) => setNewPasswordInput(event.target.value)}
            />

            <label className="profile-field-label">Xác nhận mật khẩu mới</label>
            <input
              className="profile-input"
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmNewPasswordInput}
              onChange={(event) =>
                setConfirmNewPasswordInput(event.target.value)
              }
            />

            <button
              type="button"
              className="profile-primary-btn profile-full-btn"
              onClick={handleUpdatePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PlayerProfile;
