let resolvedApiUrl: string | null = null;
let resolvedSocketUrl: string | null = null;

function isTauri() {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export async function discoverServer(): Promise<{ apiUrl: string; socketUrl: string }> {
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const address = await invoke<string>("discover_server");
      const socketUrl = `http://${address}`;
      const apiUrl = `http://${address}/api/v1`;
      resolvedSocketUrl = socketUrl;
      resolvedApiUrl = apiUrl;
      console.log("[ServerDiscovery] Found via mDNS:", address);
      return { apiUrl, socketUrl };
    } catch (err) {
      console.warn("[ServerDiscovery] mDNS failed, falling back to .env:", err);
    }
  }

  // Fallback: web browser hoặc mDNS thất bại
  const apiUrl: string = import.meta.env.VITE_SERVER_API_URL || "http://localhost:3000/api/v1";
  const socketUrl: string = import.meta.env.VITE_SOCKET_URL || new URL(apiUrl).origin;

  resolvedApiUrl = apiUrl;
  resolvedSocketUrl = socketUrl;

  return { apiUrl, socketUrl };
}

export function getApiUrl(): string {
  return resolvedApiUrl || import.meta.env.VITE_SERVER_API_URL || "http://localhost:3000/api/v1";
}

export function getSocketUrl(): string {
  return resolvedSocketUrl || import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";
}