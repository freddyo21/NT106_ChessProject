import { useEffect, useRef, useState } from "react";
import "./GameTimerUI.css";

type PlayerColor = "white" | "black";

type TimerState = {
  whiteTimeMs: number;
  blackTimeMs: number;
  activeColor: PlayerColor | null;
  isRunning: boolean;
};

type TimerSocketPayload = Partial<TimerState>;

type SocketLike = {
  on: (event: string, listener: (payload?: TimerSocketPayload) => void) => void;
  off: (event: string, listener: (payload?: TimerSocketPayload) => void) => void;
  emit?: (event: string, payload?: unknown) => void;
};

type GameTimerProps = {
  socket?: SocketLike | null;
  initialWhiteTimeMs?: number;
  initialBlackTimeMs?: number;
  initialActiveColor?: PlayerColor | null;
  initialRunning?: boolean;
  title?: string;
  className?: string;
  onTimeout?: (color: PlayerColor) => void;
};

// Socket event names are centralized here so backend integration only needs one mapping update.
export const TIMER_SOCKET_EVENTS = {
  REQUEST_SYNC: "game:timer_request_sync",
  SYNC: "game:timer_sync",
  TICK: "game:timer_tick",
  PAUSE: "game:timer_pause",
  RESUME: "game:timer_resume",
  END: "game:timer_end",
} as const;

// Format milliseconds as mm:ss for the chess clock display.
function formatTime(ms: number) {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

// Merge partial socket updates into the current timer state.
function applyTimerPatch(
  prev: TimerState,
  patch?: TimerSocketPayload
): TimerState {
  if (!patch) return prev;

  return {
    whiteTimeMs: Math.max(patch.whiteTimeMs ?? prev.whiteTimeMs, 0),
    blackTimeMs: Math.max(patch.blackTimeMs ?? prev.blackTimeMs, 0),
    activeColor: patch.activeColor ?? prev.activeColor,
    isRunning: patch.isRunning ?? prev.isRunning,
  };
}

function GameTimer({
  socket = null,
  initialWhiteTimeMs = 5 * 60 * 1000,
  initialBlackTimeMs = 5 * 60 * 1000,
  initialActiveColor = "white",
  initialRunning = false,
  title = "Game Timer",
  className = "",
  onTimeout,
}: GameTimerProps) {
  const [timerState, setTimerState] = useState<TimerState>({
    whiteTimeMs: initialWhiteTimeMs,
    blackTimeMs: initialBlackTimeMs,
    activeColor: initialActiveColor,
    isRunning: initialRunning,
  });

  const onTimeoutRef = useRef(onTimeout);
  const timeoutTriggeredRef = useRef({
    white: false,
    black: false,
  });

  // Keep the timeout callback fresh without restarting the ticking interval.
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Allow timeout callbacks again after a new positive clock value is synced.
  useEffect(() => {
    if (timerState.whiteTimeMs > 0) {
      timeoutTriggeredRef.current.white = false;
    }

    if (timerState.blackTimeMs > 0) {
      timeoutTriggeredRef.current.black = false;
    }
  }, [timerState.whiteTimeMs, timerState.blackTimeMs]);

  // Local ticking keeps the UI smooth while socket sync remains the source of truth.
  useEffect(() => {
    if (!timerState.isRunning || !timerState.activeColor) return;

    const intervalId = window.setInterval(() => {
      setTimerState((prev) => {
        if (!prev.isRunning || !prev.activeColor) {
          return prev;
        }

        const nextState = { ...prev };

        if (prev.activeColor === "white") {
          nextState.whiteTimeMs = Math.max(prev.whiteTimeMs - 1000, 0);

          if (
            nextState.whiteTimeMs === 0 &&
            !timeoutTriggeredRef.current.white
          ) {
            timeoutTriggeredRef.current.white = true;
            nextState.isRunning = false;
            onTimeoutRef.current?.("white");
          }
        } else {
          nextState.blackTimeMs = Math.max(prev.blackTimeMs - 1000, 0);

          if (
            nextState.blackTimeMs === 0 &&
            !timeoutTriggeredRef.current.black
          ) {
            timeoutTriggeredRef.current.black = true;
            nextState.isRunning = false;
            onTimeoutRef.current?.("black");
          }
        }

        return nextState;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerState.isRunning, timerState.activeColor]);

  // Listen for realtime timer updates from the game socket.
  useEffect(() => {
    if (!socket) return;

    const handleSync = (payload?: TimerSocketPayload) => {
      setTimerState((prev) => applyTimerPatch(prev, payload));
    };

    const handleTick = (payload?: TimerSocketPayload) => {
      setTimerState((prev) => applyTimerPatch(prev, payload));
    };

    const handlePause = () => {
      setTimerState((prev) => ({
        ...prev,
        isRunning: false,
      }));
    };

    const handleResume = (payload?: TimerSocketPayload) => {
      setTimerState((prev) =>
        applyTimerPatch(
          {
            ...prev,
            isRunning: true,
          },
          payload
        )
      );
    };

    const handleEnd = (payload?: TimerSocketPayload) => {
      setTimerState((prev) => ({
        ...applyTimerPatch(prev, payload),
        isRunning: false,
      }));
    };

    socket.on(TIMER_SOCKET_EVENTS.SYNC, handleSync);
    socket.on(TIMER_SOCKET_EVENTS.TICK, handleTick);
    socket.on(TIMER_SOCKET_EVENTS.PAUSE, handlePause);
    socket.on(TIMER_SOCKET_EVENTS.RESUME, handleResume);
    socket.on(TIMER_SOCKET_EVENTS.END, handleEnd);

    // Request the current timer snapshot when the component mounts.
    socket.emit?.(TIMER_SOCKET_EVENTS.REQUEST_SYNC);

    return () => {
      socket.off(TIMER_SOCKET_EVENTS.SYNC, handleSync);
      socket.off(TIMER_SOCKET_EVENTS.TICK, handleTick);
      socket.off(TIMER_SOCKET_EVENTS.PAUSE, handlePause);
      socket.off(TIMER_SOCKET_EVENTS.RESUME, handleResume);
      socket.off(TIMER_SOCKET_EVENTS.END, handleEnd);
    };
  }, [socket]);

  const whiteIsActive =
    timerState.activeColor === "white" && timerState.isRunning;
  const blackIsActive =
    timerState.activeColor === "black" && timerState.isRunning;

  const whiteIsLow =
    timerState.whiteTimeMs > 0 && timerState.whiteTimeMs <= 30_000;
  const blackIsLow =
    timerState.blackTimeMs > 0 && timerState.blackTimeMs <= 30_000;

  const whiteIsCritical =
    timerState.whiteTimeMs > 0 && timerState.whiteTimeMs <= 10_000;
  const blackIsCritical =
    timerState.blackTimeMs > 0 && timerState.blackTimeMs <= 10_000;

  const whiteStateText =
    timerState.whiteTimeMs === 0
      ? "Hết giờ"
      : whiteIsActive
      ? "Đang tới lượt"
      : "Đang chờ";

  const blackStateText =
    timerState.blackTimeMs === 0
      ? "Hết giờ"
      : blackIsActive
      ? "Đang tới lượt"
      : "Đang chờ";

  return (
    <section className={`game-timer ${className}`.trim()}>
      <div className="game-timer__header">
        <div>
          <p className="game-timer__eyebrow">Realtime Chess Clock</p>
          <h2 className="game-timer__title">{title}</h2>
        </div>

        <div
          className={`game-timer__status ${
            timerState.isRunning ? "is-running" : "is-paused"
          }`}
        >
          {timerState.isRunning ? "Đang chạy" : "Tạm dừng"}
        </div>
      </div>

      <div className="game-timer__body">
        <article
          className={[
            "game-timer__card",
            whiteIsActive ? "is-active" : "",
            whiteIsLow ? "is-low" : "",
            whiteIsCritical ? "is-critical" : "",
          ]
            .join(" ")
            .trim()}
        >
          <div className="game-timer__card-top">
            <div className="game-timer__player">
              <span className="game-timer__dot game-timer__dot--white" />
              <span className="game-timer__label">Trắng</span>
            </div>

            {whiteIsActive && (
              <span className="game-timer__badge">Lượt hiện tại</span>
            )}
          </div>

          <div className="game-timer__time" aria-live="polite">
            {formatTime(timerState.whiteTimeMs)}
          </div>

          <p className="game-timer__hint">{whiteStateText}</p>
        </article>

        <div className="game-timer__divider">
          <span>VS</span>
        </div>

        <article
          className={[
            "game-timer__card",
            blackIsActive ? "is-active" : "",
            blackIsLow ? "is-low" : "",
            blackIsCritical ? "is-critical" : "",
          ]
            .join(" ")
            .trim()}
        >
          <div className="game-timer__card-top">
            <div className="game-timer__player">
              <span className="game-timer__dot game-timer__dot--black" />
              <span className="game-timer__label">Đen</span>
            </div>

            {blackIsActive && (
              <span className="game-timer__badge">Lượt hiện tại</span>
            )}
          </div>

          <div className="game-timer__time" aria-live="polite">
            {formatTime(timerState.blackTimeMs)}
          </div>

          <p className="game-timer__hint">{blackStateText}</p>
        </article>
      </div>

      <div className="game-timer__footer">
        {timerState.activeColor
          ? `Đến lượt ${timerState.activeColor === "white" ? "trắng" : "đen"}`
          : "Chưa có người chơi nào đi"}
      </div>
    </section>
  );
}

export default GameTimer;
