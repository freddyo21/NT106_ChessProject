import { useEffect, useState } from "react";
import {
  discoverServer,
  testServerAddress,
  applyServerAddress,
  saveManualIp,
} from "./services/serverConfig";
import { updateHttpClientBaseUrl } from "./services/HttpClient";

type Status = "loading" | "ready" | "needsInput";

export function ServerDiscoveryGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    discoverServer().then((result) => {
      if (result.needsManualInput) {
        setStatus("needsInput");
      } else {
        updateHttpClientBaseUrl();
        setStatus("ready");
      }
    });
  }, []);

  async function handleConnect() {
    if (!inputValue.trim()) {
      setError("Vui lòng nhập địa chỉ IP server");
      return;
    }
    setTesting(true);
    setError("");

    const ok = await testServerAddress(inputValue.trim());

    if (ok) {
      applyServerAddress(inputValue.trim());
      saveManualIp(inputValue.trim());
      updateHttpClientBaseUrl();
      setStatus("ready");
    } else {
      setError("Không kết nối được tới server này. Kiểm tra lại IP và thử lại.");
    }
    setTesting(false);
  }

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "#0a0e1a",
    color: "#fff",
    fontFamily: "sans-serif",
    gap: "16px",
    padding: "24px",
  };

  if (status === "loading") {
    return (
      <div style={containerStyle}>
        <div>Đang tìm server...</div>
      </div>
    );
  }

  if (status === "needsInput") {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: "18px", fontWeight: 600 }}>Không tìm thấy server tự động</div>
        <div style={{ color: "#94a3b8", fontSize: "14px", textAlign: "center", maxWidth: "320px" }}>
          Vui lòng nhập địa chỉ IP của máy chủ (vd: 26.110.184.68:8080)
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="IP:Port server"
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#fff",
            width: "280px",
            fontSize: "14px",
          }}
        />
        {error && <div style={{ color: "#f87171", fontSize: "13px" }}>{error}</div>}
        <button
          onClick={handleConnect}
          disabled={testing}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            cursor: testing ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {testing ? "Đang kết nối..." : "Kết nối"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}