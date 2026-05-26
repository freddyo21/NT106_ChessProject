import { useEffect, useState } from "react";
import "./LoginUI.css";
import logo from "../Image/ZessOnlChessLogoDon.png";

type LoginUIProps = {
  onLoginSuccess: () => void;
};

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "123456";

function LoginUI({ onLoginSuccess }: LoginUIProps) {
  const [isLogin, setIsLogin] = useState(true);

  const [savedUsername, setSavedUsername] = useState(DEFAULT_USERNAME);
  const [savedPassword, setSavedPassword] = useState(DEFAULT_PASSWORD);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const storedUsername = localStorage.getItem("zess_saved_username");
    const storedPassword = localStorage.getItem("zess_saved_password");

    if (storedUsername && storedPassword) {
      setSavedUsername(storedUsername);
      setSavedPassword(storedPassword);
    }
  }, []);

  const validateUsername = (username: string) => {
    const trimmed = username.trim();

    if (!trimmed) return "Vui lòng nhập tên đăng nhập.";
    if (trimmed.length < 4) return "Tên đăng nhập phải có ít nhất 4 ký tự.";
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return "Tên đăng nhập chỉ được chứa chữ, số hoặc dấu gạch dưới.";
    }

    return "";
  };

  const validatePassword = (password: string) => {
    if (!password.trim()) return "Vui lòng nhập mật khẩu.";
    if (password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự.";
    return "";
  };

  const switchToLoginTab = () => {
    setIsLogin(true);
    setRegisterError("");
    setRegisterSuccess("");
  };

  const switchToRegisterTab = () => {
    setIsLogin(false);
    setLoginError("");
    setLoginSuccess("");
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (loginLoading) return;

    setLoginError("");
    setLoginSuccess("");

    const usernameError = validateUsername(loginUsername);
    if (usernameError) {
      setLoginError(usernameError);
      return;
    }

    const passwordError = validatePassword(loginPassword);
    if (passwordError) {
      setLoginError(passwordError);
      return;
    }

    setLoginLoading(true);

    setTimeout(() => {
      const normalizedUsername = loginUsername.trim();

      if (
        normalizedUsername === savedUsername &&
        loginPassword === savedPassword
      ) {
        setLoginSuccess("Đăng nhập thành công. Đang chuyển vào bàn cờ...");

        setTimeout(() => {
          onLoginSuccess();
        }, 900);
      } else {
        setLoginError("Sai tài khoản hoặc mật khẩu.");
      }

      setLoginLoading(false);
    }, 800);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (registerLoading) return;

    setRegisterError("");
    setRegisterSuccess("");

    const usernameError = validateUsername(registerUsername);
    if (usernameError) {
      setRegisterError(usernameError);
      return;
    }

    const passwordError = validatePassword(registerPassword);
    if (passwordError) {
      setRegisterError(passwordError);
      return;
    }

    if (!confirmPassword.trim()) {
      setRegisterError("Vui lòng nhập lại mật khẩu.");
      return;
    }

    if (registerPassword !== confirmPassword) {
      setRegisterError("Mật khẩu xác nhận không khớp.");
      return;
    }

    const normalizedRegisterUsername = registerUsername.trim();

    if (normalizedRegisterUsername === savedUsername) {
      setRegisterError("Tên đăng nhập này đã tồn tại.");
      return;
    }

    setRegisterLoading(true);

    setTimeout(() => {
      setSavedUsername(normalizedRegisterUsername);
      setSavedPassword(registerPassword);

      localStorage.setItem("zess_saved_username", normalizedRegisterUsername);
      localStorage.setItem("zess_saved_password", registerPassword);

      setRegisterSuccess("Đăng ký thành công. Hãy đăng nhập để tiếp tục.");
      setRegisterLoading(false);

      setLoginUsername(normalizedRegisterUsername);
      setLoginPassword("");

      setRegisterUsername("");
      setRegisterPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setIsLogin(true);
        setRegisterSuccess("");
      }, 900);
    }, 800);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <div className="brand-block">
            <img src={logo} alt="Zess Online Chess logo" className="logo-img" />
            <h1 className="brand-title">Zess Online Chess</h1>
          </div>

          <p>
            Giao diện xác thực cho ứng dụng desktop. Người chơi có thể đăng nhập
            hoặc đăng ký tài khoản trước khi vào sảnh game.
          </p>

          <hr />

          <p>
            Là sản phẩm đồ án của nhóm 11 của lớp NT106.Q23.ANTT của UIT
          </p>
        </div>

        <div className="auth-right">
          <div className="auth-tabs">
            <button
              className={isLogin ? "tab active" : "tab"}
              onClick={switchToLoginTab}
              type="button"
              disabled={loginLoading || registerLoading}
            >
              Đăng nhập
            </button>
            <button
              className={!isLogin ? "tab active" : "tab"}
              onClick={switchToRegisterTab}
              type="button"
              disabled={loginLoading || registerLoading}
            >
              Đăng ký
            </button>
          </div>

          {isLogin ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <h2>Đăng nhập</h2>

              <label htmlFor="login-username">Tên đăng nhập</label>
              <input
                id="login-username"
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                disabled={loginLoading}
              />

              <label htmlFor="login-password">Mật khẩu</label>
              <div className="password-field">
                <input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loginLoading}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  disabled={loginLoading}
                >
                  {showLoginPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>

              {loginError && <div className="message error">{loginError}</div>}
              {loginSuccess && (
                <div className="message success">{loginSuccess}</div>
              )}

              <button type="submit" className="submit-btn" disabled={loginLoading}>
                {loginLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>

              <p className="switch-text">
                Chưa có tài khoản?{" "}
                <span onClick={switchToRegisterTab}>Đăng ký</span>
              </p>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <h2>Đăng ký</h2>

              <label htmlFor="register-username">Tên đăng nhập</label>
              <input
                id="register-username"
                type="text"
                placeholder="Tạo tên đăng nhập"
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
                disabled={registerLoading}
              />

              <label htmlFor="register-password">Mật khẩu</label>
              <div className="password-field">
                <input
                  id="register-password"
                  type={showRegisterPassword ? "text" : "password"}
                  placeholder="Tạo mật khẩu"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  disabled={registerLoading}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                  disabled={registerLoading}
                >
                  {showRegisterPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>

              <label htmlFor="confirm-password">Xác nhận mật khẩu</label>
              <div className="password-field">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={registerLoading}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={registerLoading}
                >
                  {showConfirmPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>

              {registerError && (
                <div className="message error">{registerError}</div>
              )}
              {registerSuccess && (
                <div className="message success">{registerSuccess}</div>
              )}

              <button
                type="submit"
                className="submit-btn"
                disabled={registerLoading}
              >
                {registerLoading ? "Đang đăng ký..." : "Đăng ký"}
              </button>

              <p className="switch-text">
                Đã có tài khoản?{" "}
                <span onClick={switchToLoginTab}>Đăng nhập</span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginUI;