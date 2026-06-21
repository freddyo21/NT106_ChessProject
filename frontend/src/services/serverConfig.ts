const MANUAL_IP_KEY = "zess_manual_server_ip";

let resolvedApiUrl: string | null = null;
let resolvedSocketUrl: string | null = null;

function isTauri() {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

function buildUrls(address: string) {
  const clean = address.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return {
    apiUrl: `http://${clean}/api/v1`,
    socketUrl: `http://${clean}`,
  };
}

export function getSavedManualIp(): string | null {
  try {
    return localStorage.getItem(MANUAL_IP_KEY);
  } catch {
    return null;
  }
}

export function saveManualIp(address: string) {
  try {
    localStorage.setItem(MANUAL_IP_KEY, address);
  } catch {
    // ignore
  }
}

export function clearManualIp() {
  try {
    localStorage.removeItem(MANUAL_IP_KEY);
  } catch {
    // ignore
  }
}

export async function testServerAddress(address: string): Promise<boolean> {
  try {
    const { apiUrl } = buildUrls(address);
    const healthUrl = apiUrl.replace("/api/v1", "/health");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export function applyServerAddress(address: string) {
  const { apiUrl, socketUrl } = buildUrls(address);
  resolvedApiUrl = apiUrl;
  resolvedSocketUrl = socketUrl;
}

export async function discoverServer(): Promise<{ apiUrl: string; socketUrl: string; needsManualInput: boolean }> {
  // 1. Thử mDNS trước nếu chạy trong Tauri
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const address = await invoke<string>("discover_server");
      applyServerAddress(address);
      console.log("[ServerDiscovery] Found via mDNS:", address);
      return { apiUrl: resolvedApiUrl!, socketUrl: resolvedSocketUrl!, needsManualInput: false };
    } catch (err) {
      console.warn("[ServerDiscovery] mDNS failed:", err);
    }
  }

  // 2. Thử IP đã lưu thủ công từ lần trước
  const savedIp = getSavedManualIp();
  if (savedIp) {
    const ok = await testServerAddress(savedIp);
    if (ok) {
      applyServerAddress(savedIp);
      console.log("[ServerDiscovery] Using saved manual IP:", savedIp);
      return { apiUrl: resolvedApiUrl!, socketUrl: resolvedSocketUrl!, needsManualInput: false };
    }
  }

  // 3. Web browser (không phải Tauri) - dùng .env nếu có
  if (!isTauri()) {
    const apiUrl: string = import.meta.env.VITE_SERVER_API_URL || "";
    if (apiUrl) {
      const socketUrl: string = import.meta.env.VITE_SOCKET_URL || new URL(apiUrl).origin;
      resolvedApiUrl = apiUrl;
      resolvedSocketUrl = socketUrl;
      return { apiUrl, socketUrl, needsManualInput: false };
    }
  }

  // 4. Không tìm được gì cả - cần người dùng nhập tay
  return { apiUrl: "", socketUrl: "", needsManualInput: true };
}

export function getApiUrl(): string {
  return resolvedApiUrl || "http://localhost:3000/api/v1";
}

export function getSocketUrl(): string {
  return resolvedSocketUrl || "http://localhost:3000";
}