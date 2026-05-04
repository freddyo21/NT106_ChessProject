import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginUI.css";
import logo from "../Image/ZessOnlChessLogoDon.svg";

type AuthMode = "login" | "register" | "forgot_password";

type DemoSessionUser = {
  gmail: string;
  displayName: string;
  username: string;
};

type MessageState = {
  type: "error" | "success";
  text: string;
} | null;

const DEMO_AUTH_KEY = "zess_demo_logged_in";
const USER_STORAGE_KEY = "zess_demo_user";
const DEMO_PASSWORD_KEY = "zess_demo_password";
const PROFILE_STORAGE_KEY = "zess_demo_profile";

function getFallbackDemoUser(): DemoSessionUser {
  //{giải thích code} Tài khoản demo mặc định để test giao diện đăng nhập.
  return {
    gmail: "admin@gmail.com",
    displayName: "Lake",
    username: "HoKR2911",
  };
}

function getStoredDemoUser(): DemoSessionUser {
  //{giải thích code} Lấy user đã lưu trong localStorage, nếu chưa có thì dùng user mặc định.
  const fallbackUser = getFallbackDemoUser();

  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!rawUser) return fallbackUser;

    const parsedUser = JSON.parse(rawUser) as DemoSessionUser;

    if (parsedUser.gmail && parsedUser.displayName && parsedUser.username) {
      return parsedUser;
    }

    return fallbackUser;
  } catch {
    return fallbackUser;
  }
}

function getStoredDemoPassword() {
  //{giải thích code} Lấy mật khẩu demo đã lưu, nếu chưa có thì dùng mật khẩu mặc định.
  return localStorage.getItem(DEMO_PASSWORD_KEY) || "123456";
}

function ensureDemoProfile() {
  //{giải thích code} Tạo dữ liệu profile demo mặc định để LobbyPage và PlayerProfile dùng được ngay.
  const existingProfile = localStorage.getItem(PROFILE_STORAGE_KEY);

  if (existingProfile) return;

  const defaultProfile = {
    elo: 1420,
    wins: 24,
    losses: 10,
    draws: 6,
  };

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(defaultProfile));
}

function LoginUI() {
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState<MessageState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [registerEmail, setRegisterEmail] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);

  const [forgotIdentifier, setForgotIdentifier] = useState("");

  const switchMode = (mode: AuthMode) => {
    //{giải thích code} Chuyển tab giữa đăng nhập, đăng ký và quên mật khẩu, đồng thời xóa thông báo cũ.
    setAuthMode(mode);
    setMessage(null);
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    //{giải thích code} Bắt đầu submit và xóa thông báo cũ.
    setIsSubmitting(true);
    setMessage(null);

    const normalizedUsername = loginUsername.trim();
    const normalizedPassword = loginPassword.trim();

    if (!normalizedUsername || !normalizedPassword) {
      setMessage({
        type: "error",
        text: "Vui lòng nhập đầy đủ tên tài khoản và mật khẩu.",
      });
      setIsSubmitting(false);
      return;
    }

    const storedUser = getStoredDemoUser();
    const storedPassword = getStoredDemoPassword();

    const isValidLogin =
      normalizedUsername.toLowerCase() === storedUser.username.toLowerCase() &&
      normalizedPassword === storedPassword;

    if (!isValidLogin) {
      setMessage({
        type: "error",
        text: "Sai tên tài khoản hoặc mật khẩu. Demo mặc định: HoKR2911 / 123456",
      });
      setIsSubmitting(false);
      return;
    }

    //{giải thích code} Lưu trạng thái đăng nhập và user hiện tại để các màn sau dùng lại.
    localStorage.setItem(DEMO_AUTH_KEY, "true");
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(storedUser));
    ensureDemoProfile();

    setMessage({
      type: "success",
      text: "Đăng nhập thành công. Đang chuyển vào Lobby...",
    });

    setIsSubmitting(false);
    navigate("/lobby", { replace: true });
  };

  const handleRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage(null);

    const normalizedEmail = registerEmail.trim().toLowerCase();
    const normalizedDisplayName = registerDisplayName.trim();
    const normalizedUsername = registerUsername.trim();

    if (
      !normalizedEmail ||
      !normalizedDisplayName ||
      !normalizedUsername ||
      !registerPassword.trim() ||
      !registerConfirmPassword.trim()
    ) {
      setMessage({
        type: "error",
        text: "Vui lòng nhập đầy đủ tất cả các trường đăng ký.",
      });
      setIsSubmitting(false);
      return;
    }

    if (!normalizedEmail.endsWith("@gmail.com")) {
      setMessage({
        type: "error",
        text: "Hiện tại giao diện demo chỉ chấp nhận địa chỉ Gmail.",
      });
      setIsSubmitting(false);
      return;
    }

    if (normalizedDisplayName.length < 2) {
      setMessage({
        type: "error",
        text: "Tên hiển thị phải có ít nhất 2 ký tự.",
      });
      setIsSubmitting(false);
      return;
    }

    if (normalizedUsername.length < 4) {
      setMessage({
        type: "error",
        text: "Tên tài khoản phải có ít nhất 4 ký tự.",
      });
      setIsSubmitting(false);
      return;
    }

    if (/\s/.test(normalizedUsername)) {
      setMessage({
        type: "error",
        text: "Tên tài khoản không được chứa khoảng trắng.",
      });
      setIsSubmitting(false);
      return;
    }

    if (registerPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
      setIsSubmitting(false);
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setMessage({
        type: "error",
        text: "Xác nhận mật khẩu chưa khớp.",
      });
      setIsSubmitting(false);
      return;
    }

    const newDemoUser: DemoSessionUser = {
      gmail: normalizedEmail,
      displayName: normalizedDisplayName,
      username: normalizedUsername,
    };

    //{giải thích code} Lưu tài khoản demo mới để dùng cho đăng nhập và các màn sau.
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newDemoUser));
    localStorage.setItem(DEMO_PASSWORD_KEY, registerPassword);
    ensureDemoProfile();

    //{giải thích code} Đổ sẵn tên tài khoản vào ô login để tiện đăng nhập ngay.
    setLoginUsername(normalizedUsername);
    setLoginPassword("");

    //{giải thích code} Reset form đăng ký sau khi đăng ký thành công.
    setRegisterEmail("");
    setRegisterDisplayName("");
    setRegisterUsername("");
    setRegisterPassword("");
    setRegisterConfirmPassword("");

    setAuthMode("login");
    setMessage({
      type: "success",
      text: "Đăng ký demo thành công. Bạn có thể đăng nhập ngay bây giờ.",
    });

    setIsSubmitting(false);
  };

  const handleForgotPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage(null);

    const normalizedIdentifier = forgotIdentifier.trim().toLowerCase();

    if (!normalizedIdentifier) {
      setMessage({
        type: "error",
        text: "Vui lòng nhập Gmail hoặc tên tài khoản.",
      });
      setIsSubmitting(false);
      return;
    }

    const storedUser = getStoredDemoUser();

    const isMatched =
      normalizedIdentifier === storedUser.gmail.toLowerCase() ||
      normalizedIdentifier === storedUser.username.toLowerCase();

    if (!isMatched) {
      setMessage({
        type: "error",
        text: "Không tìm thấy tài khoản phù hợp trong dữ liệu demo.",
      });
      setIsSubmitting(false);
      return;
    }

    setMessage({
      type: "success",
      text: "Đã gửi OTP demo tới gmail của bạn. Ở bản hiện tại đây chỉ là giao diện mô phỏng.",
    });

    setIsSubmitting(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <div className="brand-block">
            <img className="logo-img" src={logo} alt="Zess Online Chess logo" />
            <h1 className="brand-title">Zess Online Chess</h1>
          </div>
          <p>
            Là sản phẩm đồ án của nhóm 11 của lớp NT106.Q23.ANTT của UIT
          </p>
        </div>

        <div className="auth-right">
          {authMode !== "forgot_password" ? (
            <div className="auth-tabs">
              <button
                type="button"
                className={`tab ${authMode === "login" ? "active" : ""}`}
                onClick={() => switchMode("login")}
                disabled={isSubmitting}
              >
                Đăng nhập
              </button>

              <button
                type="button"
                className={`tab ${authMode === "register" ? "active" : ""}`}
                onClick={() => switchMode("register")}
                disabled={isSubmitting}
              >
                Đăng ký
              </button>
            </div>
          ) : (
            <div className="auth-inline-top">
              <button
                type="button"
                className="back-inline-btn"
                onClick={() => switchMode("login")}
                disabled={isSubmitting}
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          )}

          {authMode === "login" && (
            <form className="auth-form" onSubmit={handleLogin}>
              <h2>Đăng nhập</h2>
              <p className="auth-description">
                Đăng nhập bằng tên tài khoản và mật khẩu để vào hệ thống.
              </p>

              <label htmlFor="login-username">Tên tài khoản</label>
              <input
                id="login-username"
                type="text"
                placeholder="Nhập tên tài khoản"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                disabled={isSubmitting}
              />

              <label htmlFor="login-password">Mật khẩu</label>
              <div className="password-field">
                <input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  disabled={isSubmitting}
                >
                  {showLoginPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>

              <button
                type="button"
                className="forgot-password-btn"
                onClick={() => switchMode("forgot_password")}
                disabled={isSubmitting}
              >
                Quên mật khẩu?
              </button>

              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
              >
                Đăng nhập
              </button>

              {message && (
                <div className={`message ${message.type}`}>{message.text}</div>
              )}

              <p className="switch-text">
                Chưa có tài khoản?{" "}
                <span onClick={() => switchMode("register")}>Đăng ký</span>
              </p>
            </form>
          )}

          {authMode === "register" && (
            <form className="auth-form" onSubmit={handleRegister}>
              <h2>Đăng ký</h2>
              <p className="auth-description">
                Đăng ký bằng Gmail để thuận tiện cho xác thực OTP và khôi phục
                mật khẩu sau này.
              </p>

              <label htmlFor="register-gmail">Gmail</label>
              <input
                id="register-gmail"
                type="gmail"
                placeholder="Nhập Gmail"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                disabled={isSubmitting}
              />
              <p className="input-hint">
                Chỉ chấp nhận địa chỉ có đuôi @gmail.com.
              </p>

              <label htmlFor="register-display-name">Tên hiển thị</label>
              <input
                id="register-display-name"
                type="text"
                placeholder="Nhập tên hiển thị"
                value={registerDisplayName}
                onChange={(event) => setRegisterDisplayName(event.target.value)}
                disabled={isSubmitting}
              />

              <label htmlFor="register-username">Tên tài khoản</label>
              <input
                id="register-username"
                type="text"
                placeholder="Tạo tên tài khoản"
                value={registerUsername}
                onChange={(event) => setRegisterUsername(event.target.value)}
                disabled={isSubmitting}
              />

              <label htmlFor="register-password">Mật khẩu</label>
              <div className="password-field">
                <input
                  id="register-password"
                  type={showRegisterPassword ? "text" : "password"}
                  placeholder="Tạo mật khẩu"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                  disabled={isSubmitting}
                >
                  {showRegisterPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>

              <label htmlFor="register-confirm-password">
                Xác nhận mật khẩu
              </label>
              <div className="password-field">
                <input
                  id="register-confirm-password"
                  type={showRegisterConfirmPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  value={registerConfirmPassword}
                  onChange={(event) =>
                    setRegisterConfirmPassword(event.target.value)
                  }
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() =>
                    setShowRegisterConfirmPassword((prev) => !prev)
                  }
                  disabled={isSubmitting}
                >
                  {showRegisterConfirmPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
              >
                Đăng ký
              </button>

              {message && (
                <div className={`message ${message.type}`}>{message.text}</div>
              )}

              <p className="switch-text">
                Đã có tài khoản?{" "}
                <span onClick={() => switchMode("login")}>Đăng nhập</span>
              </p>
            </form>
          )}

          {authMode === "forgot_password" && (
            <form className="auth-form" onSubmit={handleForgotPassword}>
              <h2>Quên mật khẩu</h2>
              <p className="auth-description">
                Nhập Gmail hoặc tên tài khoản để nhận OTP khôi phục mật
                khẩu. Hiện tại đây là luồng demo giao diện.
              </p>

              <label htmlFor="forgot-identifier">
                Gmail hoặc tên tài khoản
              </label>
              <input
                id="forgot-identifier"
                type="text"
                placeholder="Ví dụ: admin@gmail.com hoặc HoKR2911"
                value={forgotIdentifier}
                onChange={(event) => setForgotIdentifier(event.target.value)}
                disabled={isSubmitting}
              />

              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
              >
                Gửi OTP demo
              </button>

              {message && (
                <div className={`message ${message.type}`}>{message.text}</div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginUI;