import { useState } from "react";
import "./LoginUI.css";
import logo from "./ZessOnlChessLogoDon.png";

function LoginUI() {
  const [isLogin, setIsLogin] = useState(true);

  const [savedUsername, setSavedUsername] = useState("admin");
  const [savedPassword, setSavedPassword] = useState("123456");

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginSuccess("");

    if (!loginUsername.trim()) {
      setLoginError("Vui lòng nhập tên đăng nhập.");
      return;
    }

    if (!loginPassword.trim()) {
      setLoginError("Vui lòng nhập mật khẩu.");
      return;
    }

    setLoginLoading(true);

    setTimeout(() => {
      if (
        loginUsername === savedUsername &&
        loginPassword === savedPassword
      ) {
        setLoginSuccess("Đăng nhập thành công.");
      } else {
        setLoginError("Sai tài khoản hoặc mật khẩu.");
      }
      setLoginLoading(false);
    }, 1000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");
    setRegisterSuccess("");

    if (!registerUsername.trim()) {
      setRegisterError("Vui lòng nhập tên đăng nhập.");
      return;
    }

    if (!registerPassword.trim()) {
      setRegisterError("Vui lòng nhập mật khẩu.");
      return;
    }

    if (registerPassword.length < 6) {
      setRegisterError("Mật khẩu phải có ít nhất 6 ký tự.");
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

    setRegisterLoading(true);

    setTimeout(() => {
      setSavedUsername(registerUsername);
      setSavedPassword(registerPassword);

      setRegisterSuccess("Đăng ký thành công. Bạn có thể đăng nhập.");
      setRegisterLoading(false);

      setLoginUsername(registerUsername);
      setLoginPassword("");

      setRegisterUsername("");
      setRegisterPassword("");
      setConfirmPassword("");
    }, 1000);
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
              onClick={() => setIsLogin(true)}
              type="button"
            >
              Đăng nhập
            </button>
            <button
              className={!isLogin ? "tab active" : "tab"}
              onClick={() => setIsLogin(false)}
              type="button"
            >
              Đăng ký
            </button>
          </div>

          {isLogin ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <h2>Đăng nhập</h2>

              <label>Tên đăng nhập</label>
              <input
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              />

              <label>Mật khẩu</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />

              {loginError && <div className="message error">{loginError}</div>}
              {loginSuccess && <div className="message success">{loginSuccess}</div>}

              <button type="submit" className="submit-btn" disabled={loginLoading}>
                {loginLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>

              <p className="switch-text">
                Chưa có tài khoản?{" "}
                <span onClick={() => setIsLogin(false)}>Đăng ký</span>
              </p>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <h2>Đăng ký</h2>

              <label>Tên đăng nhập</label>
              <input
                type="text"
                placeholder="Tạo tên đăng nhập"
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
              />

              <label>Mật khẩu</label>
              <input
                type="password"
                placeholder="Tạo mật khẩu"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
              />

              <label>Xác nhận mật khẩu</label>
              <input
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              {registerError && <div className="message error">{registerError}</div>}
              {registerSuccess && <div className="message success">{registerSuccess}</div>}

              <button
                type="submit"
                className="submit-btn"
                disabled={registerLoading}
              >
                {registerLoading ? "Đang đăng ký..." : "Đăng ký"}
              </button>

              <p className="switch-text">
                Đã có tài khoản?{" "}
                <span onClick={() => setIsLogin(true)}>Đăng nhập</span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginUI;