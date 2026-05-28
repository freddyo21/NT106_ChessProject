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

//{Các event socket này chỉ là tên gợi ý để bạn và bạn DuyAnh nối backend sau}
//{Khi backend có event thật thì chỉ cần sửa lại đúng tên ở đây}
export const TIMER_SOCKET_EVENTS = {
  REQUEST_SYNC: "game:timer_request_sync",
  SYNC: "game:timer_sync",
  TICK: "game:timer_tick",
  PAUSE: "game:timer_pause",
  RESUME: "game:timer_resume",
  END: "game:timer_end",
} as const;

//{Format mili giây thành mm:ss}
function formatTime(ms: number) {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

//{Ghép dữ liệu mới từ socket vào state hiện tại}
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

  //{Giữ callback timeout luôn là bản mới nhất}
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  //{Nếu thời gian được reset lại lớn hơn 0 thì cho phép timeout được gọi lại ở ván mới}
  useEffect(() => {
    if (timerState.whiteTimeMs > 0) {
      timeoutTriggeredRef.current.white = false;
    }

    if (timerState.blackTimeMs > 0) {
      timeoutTriggeredRef.current.black = false;
    }
  }, [timerState.whiteTimeMs, timerState.blackTimeMs]);

  //{Interval local để đồng hồ vẫn chạy mượt ở client}
  //{Server/socket vẫn là nguồn dữ liệu chính, event sync sẽ tự chỉnh lại nếu lệch}
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

  //{Lắng nghe dữ liệu realtime từ socket}
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

    //{Khi component mount thì xin server gửi trạng thái timer hiện tại}
    socket.emit?.(TIMER_SOCKET_EVENTS.REQUEST_SYNC);

    return () => {
      socket.off(TIMER_SOCKET_EVENTS.SYNC, handleSync);
      socket.off(TIMER_SOCKET_EVENTS.TICK, handleTick);
      socket.off(TIMER_SOCKET_EVENTS.PAUSE, handlePause);
      socket.off(TIMER_SOCKET_EVENTS.RESUME, handleResume);
      socket.off(TIMER_SOCKET_EVENTS.END, handleEnd);
    };
  }, [socket]);

  const whiteIsActive = timerState.activeColor === "white" && timerState.isRunning;
  const blackIsActive = timerState.activeColor === "black" && timerState.isRunning;

  const whiteIsLow = timerState.whiteTimeMs > 0 && timerState.whiteTimeMs <= 30_000;
  const blackIsLow = timerState.blackTimeMs > 0 && timerState.blackTimeMs <= 30_000;

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

            {whiteIsActive && <span className="game-timer__badge">Lượt hiện tại</span>}
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

            {blackIsActive && <span className="game-timer__badge">Lượt hiện tại</span>}
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