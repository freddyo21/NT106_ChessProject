import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type LoginResponseDTO } from "@zess-online-chess/shared";
import { setAuthSession } from "../services/authSession";
import { userForgotPassword, userLogin, userRegister } from "../services/auth.services";
import "./LoginUI.css";
import logo from "../Image/ZessOnlChessLogoDon.svg";

type AuthMode = "login" | "register" | "forgot_password";

type MessageState = {
  type: "error" | "success";
  text: string;
} | null;

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

function LoginUI() {
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState<MessageState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [registerEmail, setRegisterEmail] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  const [forgotIdentifier, setForgotIdentifier] = useState("");

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setMessage(null);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = (await userLogin({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
        rememberMe,
      })) as LoginResponseDTO;

      // The whole realtime layer reads accessToken from this session helper.
      setAuthSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });

      navigate("/lobby", { replace: true });
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error) || "Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      await userRegister({
        name: registerDisplayName.trim(),
        email: registerEmail.trim().toLowerCase(),
        username: registerUsername.trim(),
        password: registerPassword,
        confirmPassword: registerConfirmPassword,
      });

      setLoginEmail(registerEmail.trim().toLowerCase());
      setLoginPassword("");
      setRegisterEmail("");
      setRegisterDisplayName("");
      setRegisterUsername("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      setAuthMode("login");
      setMessage({
        type: "success",
        text: "Đăng ký thành công. Vui lòng đăng nhập.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error) || "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      await userForgotPassword(forgotIdentifier.trim().toLowerCase());
      setMessage({
        type: "success",
        text: "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục mật khẩu đã được gửi.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error) || "Không thể gửi yêu cầu khôi phục mật khẩu.",
      });
    } finally {
      setIsSubmitting(false);
    }
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
                Đăng nhập bằng email và mật khẩu để vào hệ thống.
              </p>

              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="Nhập email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
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
                  autoComplete="current-password"
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

              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={isSubmitting}
                />
                Ghi nhớ đăng nhập
              </label>

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
                {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
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
                Vui lòng nhập đầy đủ thông tin phía dưới để tạo tài khoản.
              </p>

              <label htmlFor="register-gmail">Email</label>
              <input
                id="register-gmail"
                type="email"
                placeholder="Nhập email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
              />

              <label htmlFor="register-display-name">Tên hiển thị</label>
              <input
                id="register-display-name"
                type="text"
                placeholder="Nhập tên hiển thị"
                value={registerDisplayName}
                onChange={(event) => setRegisterDisplayName(event.target.value)}
                disabled={isSubmitting}
                autoComplete="name"
              />

              <label htmlFor="register-username">Tên tài khoản</label>
              <input
                id="register-username"
                type="text"
                placeholder="Tạo tên tài khoản"
                value={registerUsername}
                onChange={(event) => setRegisterUsername(event.target.value)}
                disabled={isSubmitting}
                autoComplete="username"
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
                  autoComplete="new-password"
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
                  onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
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
                {isSubmitting ? "Đang đăng ký..." : "Đăng ký"}
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
                Nhập email để nhận hướng dẫn khôi phục mật khẩu.
              </p>

              <label htmlFor="forgot-identifier">Email</label>
              <input
                id="forgot-identifier"
                type="email"
                placeholder="Nhập email"
                value={forgotIdentifier}
                onChange={(event) => setForgotIdentifier(event.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
              />

              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
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
