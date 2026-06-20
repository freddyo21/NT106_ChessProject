import { useEffect, useState } from "react";
import { discoverServer } from "./services/serverConfig";
import { updateHttpClientBaseUrl } from "./services/HttpClient";

export function ServerDiscoveryGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    discoverServer().then(() => {
      updateHttpClientBaseUrl();
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0a0e1a",
        color: "#fff",
        fontFamily: "sans-serif",
      }}>
        <div>Đang tìm server...</div>
      </div>
    );
  }

  return <>{children}</>;
}