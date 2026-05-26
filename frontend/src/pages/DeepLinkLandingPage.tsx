import { useEffect, useState } from "react";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import type { UnlistenFn } from "@tauri-apps/api/event";
import "./DeepLinkLandingPage.css";

const PRIMARY_INVITE_SCHEME = "nt106";
const ACCEPTED_INVITE_SCHEMES = new Set([
  "nt106",
  "com.admin.zess-online-chess",
]);

type DeepLinkDetails = {
  rawUrl: string;
  route: string;
  roomId: string | null;
  code: string | null;
};

function parseDeepLink(rawUrl: string): DeepLinkDetails | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  const protocol = parsedUrl.protocol.replace(/:$/, "");

  if (!ACCEPTED_INVITE_SCHEMES.has(protocol)) {
    return null;
  }

  const route = [parsedUrl.hostname, parsedUrl.pathname.replace(/^\//, "")]
    .filter(Boolean)
    .join("/") || "open";

  const routeSegments = route.split("/").filter(Boolean);
  const joinSegmentIndex = routeSegments.lastIndexOf("join");
  const roomIdFromPath =
    joinSegmentIndex >= 0 && joinSegmentIndex + 1 < routeSegments.length
      ? routeSegments[joinSegmentIndex + 1]
      : null;

  const roomId =
    parsedUrl.searchParams.get("roomId") ??
    parsedUrl.searchParams.get("rid") ??
    roomIdFromPath;
  const code =
    parsedUrl.searchParams.get("code") ?? parsedUrl.searchParams.get("invite");

  return {
    rawUrl,
    route,
    roomId,
    code,
  };
}

function formatInviteLink(details: DeepLinkDetails | null): string {
  if (!details) {
    return `${PRIMARY_INVITE_SCHEME}://join?roomId=ROOM_ID&code=INVITE_CODE`;
  }

  const route = details.route ? `/${details.route}` : "";
  const query = new URLSearchParams();

  if (details.roomId) {
    query.set("roomId", details.roomId);
  }

  if (details.code) {
    query.set("code", details.code);
  }

  const search = query.toString();
  return `${PRIMARY_INVITE_SCHEME}://${route}${search ? `?${search}` : ""}`;
}

export function DeepLinkLandingPage() {
  const [status, setStatus] = useState("Waiting for a deep link...");
  const [deepLink, setDeepLink] = useState<DeepLinkDetails | null>(null);

  useEffect(() => {
    let disposed = false;
    let stopListening: UnlistenFn | undefined;

    const applyUrls = (urls: string[]) => {
      const details = urls
        .map(parseDeepLink)
        .find((value): value is DeepLinkDetails => value !== null);

      if (details) {
        setDeepLink(details);
        setStatus(`Deep link received: ${details.route}`);
        return;
      }

      if (urls.length > 0) {
        setStatus(`Deep link received but unsupported: ${urls[0]}`);
      }
    };

    void getCurrent()
      .then((urls: string[] | null) => {
        if (disposed || !urls?.length) {
          return;
        }

        applyUrls(urls);
      })
      .catch((error: unknown) => {
        console.error("Failed to read current deep link", error);
        if (!disposed) {
          const detail = error instanceof Error ? error.message : String(error);
          setStatus(`Deep link startup read failed: ${detail}`);
        }
      });

    void onOpenUrl((urls: string[]) => {
      applyUrls(urls);
    })
      .then((unlisten: UnlistenFn) => {
        stopListening = unlisten;
      })
      .catch((error: unknown) => {
        console.error("Failed to subscribe to deep links", error);
      });

    return () => {
      disposed = true;
      stopListening?.();
    };
  }, []);

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">NT106 desktop invite flow</div>
        <h1>Open the app directly from an invite link.</h1>
        <p className="lede">
          The app now listens for <span>{PRIMARY_INVITE_SCHEME}://</span> links through Tauri,
          so invite URLs can land in the desktop client instead of bouncing to the browser.
        </p>

        <div className="status-pill">{status}</div>
      </section>

      <section className="grid">
        <article className="panel accent">
          <h2>Received invite</h2>
          {deepLink ? (
            <>
              <p className="mono">{deepLink.rawUrl}</p>
              <dl className="details">
                <div>
                  <dt>Route</dt>
                  <dd>{deepLink.route}</dd>
                </div>
                <div>
                  <dt>Room ID</dt>
                  <dd>{deepLink.roomId ?? "not provided"}</dd>
                </div>
                <div>
                  <dt>Code</dt>
                  <dd>{deepLink.code ?? "not provided"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="muted">
              Start the app with an invite like <span className="mono">{PRIMARY_INVITE_SCHEME}://join?roomId=123&amp;code=ABC123</span>
              and the parsed values will appear here.
            </p>
          )}
        </article>

        <article className="panel">
          <h2>Suggested link format</h2>
          <p className="muted">Use this pattern when generating shareable invites from the backend:</p>
          <pre className="code-block">{formatInviteLink(deepLink)}</pre>
          <p className="muted">
            On Windows and Linux, the single-instance plugin keeps the second launch inside the same app process,
            then forwards the URL to the listener.
          </p>
        </article>
      </section>
    </main>
  );
}