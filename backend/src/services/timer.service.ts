import { Logger } from "../utils/Logger";
import * as gameRepository from "../repositories/game.repository";
import type { PieceColor } from "../types/GameResult";
import type { TimeControlType } from "../types/TimeControl";
import type { TimeControl, TimerSnapshot } from "../types/Timer";
const logger = new Logger("timer-service");


interface TimerState {
    gameId: string;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    currentTurn: PieceColor;
    incrementSeconds: number;
    intervalId: NodeJS.Timeout | null;
    lastTickAt: number;
    onTimeout: (color: PieceColor) => void;
}

// ------Preset (as Chess.com)------
export const TIME_CONTROLS: Record<TimeControlType, TimeControl> = {
    bullet:    { type: "bullet",    initialTimeSeconds: 60,   incrementSeconds: 0 },
    blitz:     { type: "blitz",     initialTimeSeconds: 300,  incrementSeconds: 0 },
    rapid:     { type: "rapid",     initialTimeSeconds: 600,  incrementSeconds: 0 },
    classical: { type: "classical", initialTimeSeconds: 1800, incrementSeconds: 0 },
};

//----Timer Score--------

//-----roomId -> TimerState
const timers = new Map<string, TimerState>();

//--------Internal helpers-------
const tick = (roomId: string) => {
    const state = timers.get(roomId);
    if (!state) return;
 
    const now = Date.now();
    const elapsed = Math.floor((now - state.lastTickAt) / 1000);
    if (elapsed < 1) return;
 
    state.lastTickAt = now;
 
    if (state.currentTurn === "white") {
        state.whiteTimeLeft = Math.max(0, state.whiteTimeLeft - elapsed);
    } else {
        state.blackTimeLeft = Math.max(0, state.blackTimeLeft - elapsed);
    }
 
    const timeLeft = state.currentTurn === "white" ? state.whiteTimeLeft : state.blackTimeLeft;
 
    if (timeLeft <= 0) {
        const timedOutColor = state.currentTurn;
        stopInterval(roomId);
        logger.log("Timer timeout", { roomId, color: timedOutColor });
        state.onTimeout(timedOutColor);
    }
};

const stopInterval = (roomId: string) => {
    const state = timers.get(roomId);
    if (!state?.intervalId) return;
    clearInterval(state.intervalId);
    state.intervalId = null;
};

//----Public API---
/**
 * Khởi tạo timer cho room. Gọi khi game bắt đầu
 */
export const createTimer = (
    roomId: string,
    gameId: string,
    timeControl: TimeControl,
    onTimeout: (color: PieceColor) => void
): void => {
    if (timers.has(roomId)) {
        destroyTimer(roomId);
    }
 
    timers.set(roomId, {
        gameId,
        whiteTimeLeft: timeControl.initialTimeSeconds,
        blackTimeLeft: timeControl.initialTimeSeconds,
        currentTurn: "white", // White luôn đi trước
        incrementSeconds: timeControl.incrementSeconds,
        intervalId: null,
        lastTickAt: Date.now(),
        onTimeout,
    });
 
    logger.log("Timer created", { roomId, gameId, timeControl });
};

/**
 * Bắt đầu đếm giờ. Gọi ngay sau createTimer
 */
export const startTimer = (roomId: string): void => {
    const state = timers.get(roomId);
    if (!state) {
        logger.error("startTimer: room not found", { roomId });
        return;
    }
 
    if (state.intervalId) return; // Đã chạy rồi
 
    state.lastTickAt = Date.now();
    state.intervalId = setInterval(() => tick(roomId), 1000);
    logger.log("Timer started", { roomId });
};

/**
 * Đổi lượt sau khi người chơi đi xong
 * Cộng increment cho người vừa đi, đổi sang đếm giờ người kia
 * Trả về snapshot để socket emit về client
 */
export const switchTurn = async (roomId: string): Promise<TimerSnapshot | null> => {
    const state = timers.get(roomId);
    if (!state) return null;
 
    // Cộng increment cho người vừa đi
    if (state.incrementSeconds > 0) {
        if (state.currentTurn === "white") {
            state.whiteTimeLeft += state.incrementSeconds;
        } else {
            state.blackTimeLeft += state.incrementSeconds;
        }
    }

    //Đổi lượt
    state.currentTurn = state.currentTurn === "white" ? "black" : "white";
    state.lastTickAt = Date.now();

    //Preset xuống DB (best-effort, không block)
    gameRepository.updateTimeLeft(state.gameId, state.whiteTimeLeft, state.blackTimeLeft)
        .catch((err) => logger.error("updateTimeLeft failed", { roomId, err }));
 
    return getSnapshot(roomId);
};

/**
 * Tạm dừng đồng hồ
 */
export const pauseTimer = (roomId: string): void => {
    stopInterval(roomId);
    logger.log("Timer paused", { roomId });
};

/**
 * Tiếp tục sau khi pause
 */
export const resumeTimer = (roomId: string): void => {
    const state = timers.get(roomId);
    if (!state || state.intervalId) return;
 
    state.lastTickAt = Date.now();
    state.intervalId = setInterval(() => tick(roomId), 1000);
    logger.log("Timer resumed", { roomId });
};

/**
 * Dọn dẹp timer khi game kết thúc
 */
export const destroyTimer = (roomId: string): void => {
    stopInterval(roomId);
    timers.delete(roomId);
    logger.log("Timer destroyed", { roomId });
};

/**
 * Lấy snapshot hiện tại (để emit về client hoặc sync lại)
 */
export const getSnapshot = (roomId: string): TimerSnapshot | null => {
    const state = timers.get(roomId);
    if (!state) return null;
 
    return {
        whiteTimeLeft: state.whiteTimeLeft,
        blackTimeLeft: state.blackTimeLeft,
        currentTurn: state.currentTurn,
        updatedAt: Date.now(),
    };
};



