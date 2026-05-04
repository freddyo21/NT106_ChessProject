import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PlayerProfile.css";

type DemoSessionUser = {
  email: string;
  displayName: string;
  username: string;
};

type PlayerProfileStats = {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
};

const USER_STORAGE_KEY = "zess_demo_user";
const PROFILE_STORAGE_KEY = "zess_demo_profile";

function getDemoUser(): DemoSessionUser {
  const fallbackUser: DemoSessionUser = {
    email: "admin@gmail.com",
    displayName: "Lake",
    username: "HoKR2911",
  };

  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!rawUser) return fallbackUser;

    const parsedUser = JSON.parse(rawUser) as DemoSessionUser;

    if (parsedUser.displayName && parsedUser.username && parsedUser.email) {
      return parsedUser;
    }

    return fallbackUser;
  } catch {
    return fallbackUser;
  }
}

function saveDemoUser(user: DemoSessionUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function getDemoProfileStats(): PlayerProfileStats {
  const fallbackProfile: PlayerProfileStats = {
    elo: 1420,
    wins: 24,
    losses: 10,
    draws: 6,
  };

  try {
    const rawProfile = localStorage.getItem(PROFILE_STORAGE_KEY);

    if (!rawProfile) {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(fallbackProfile));
      return fallbackProfile;
    }

    const parsedProfile = JSON.parse(rawProfile) as PlayerProfileStats;

    if (
      typeof parsedProfile.elo === "number" &&
      typeof parsedProfile.wins === "number" &&
      typeof parsedProfile.losses === "number" &&
      typeof parsedProfile.draws === "number"
    ) {
      return parsedProfile;
    }

    return fallbackProfile;
  } catch {
    return fallbackProfile;
  }
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

function PlayerProfile() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<DemoSessionUser>(() =>
    getDemoUser()
  );
  const [profileStats] = useState<PlayerProfileStats>(() =>
    getDemoProfileStats()
  );

  const [editedDisplayName, setEditedDisplayName] = useState(
    currentUser.displayName
  );
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState("");

  const avatarText = useMemo(() => {
    return getAvatarText(currentUser.displayName, currentUser.username);
  }, [currentUser.displayName, currentUser.username]);

  const totalGames = useMemo(() => {
    return profileStats.wins + profileStats.losses + profileStats.draws;
  }, [profileStats]);

  const winRate = useMemo(() => {
    if (totalGames === 0) return 0;
    return Math.round((profileStats.wins / totalGames) * 100);
  }, [profileStats.wins, totalGames]);

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

    const updatedUser: DemoSessionUser = {
      ...currentUser,
      displayName: normalizedDisplayName,
    };

    setCurrentUser(updatedUser);
    saveDemoUser(updatedUser);
    alert("Đã cập nhật tên hiển thị.");
  };

  const handleUpdatePassword = () => {
    if (
      !currentPasswordInput.trim() ||
      !newPasswordInput.trim() ||
      !confirmNewPasswordInput.trim()
    ) {
      alert("Vui lòng nhập đầy đủ các trường mật khẩu.");
      return;
    }

    if (newPasswordInput.length < 6) {
      alert("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      alert("Xác nhận mật khẩu chưa khớp.");
      return;
    }

    alert("Đã cập nhật mật khẩu trên giao diện demo.");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmNewPasswordInput("");
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
            <h1>{currentUser.displayName}</h1>
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

          <div className="player-profile-stats-grid">
            {profileStatCards.map((statCard) => (
              <div className="player-profile-stat-card" key={statCard.label}>
                <p className="player-profile-stat-value">{statCard.value}</p>
                <p className="player-profile-stat-label">{statCard.label}</p>
              </div>
            ))}
          </div>
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
            >
              Cập nhật mật khẩu
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PlayerProfile;