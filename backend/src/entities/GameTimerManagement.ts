import { EventEmitter } from "events";
import { EndGameLogic, GameEndResult } from "./EndGameLogic";
import { Color } from "../types/Color";

//------------
//TYPES
//------------
export type TimeControlType = "bullet" | "blitz" | "rapid" | "classical";

export interface TimeControl {
    type: TimeControlType;
    initialSeconds: number;
    incrementSeconds: number;
}

export interface TimerState {
    whiteTimeLeft: number;
    blackTimeLeft: number;
    currentTurn: Color;
    isRunning: boolean;
}

//----------------
//Preset (Chess.com / Lichess standard)
//----------------
export const TIME_CONTROL_PRESETS: Record<string, TimeControl> = {
    "bullet_1_0":     { type: "bullet",   initialSeconds: 60, incrementSeconds: 0 },
    "bullet_2_1":     { type: "bullet",   initialSeconds: 120, incrementSeconds: 1 },
    "blitz_3_2":      { type: "blitz",    initialSeconds: 180, incrementSeconds: 2 },
    "blitz_5_0":      { type: "blitz",     initialSeconds: 300,  incrementSeconds: 0 },
    "blitz_5_3":      { type: "blitz",     initialSeconds: 300,  incrementSeconds: 3 },
    "rapid_10_0":     { type: "rapid",     initialSeconds: 600,  incrementSeconds: 0 },
    "rapid_10_5":     { type: "rapid",     initialSeconds: 600,  incrementSeconds: 5 },
    "rapid_15_10":    { type: "rapid",     initialSeconds: 900,  incrementSeconds: 10 },
    "classical_30_0": { type: "classical", initialSeconds: 1800, incrementSeconds: 0 },
};


//----------------
//GameTimerManagement
//----------------
export class GameTimerManagement extends EventEmitter {
    private readonly gameID: string;
    private readonly endGameLogic: EndGameLogic;
    private readonly increment: number;  //ms
    
    private whiteTimeLeft: number; //ms
    private blackTimeLeft: number; //ms
    private currentTurn: Color;
    private isRunning: boolean = false;

    private tickInterval: NodeJS.Timeout | null = null;
    private turnStartedAt: number | null = null;

    private static readonly TICK_MS = 100;

    constructor(
        gameID: string,
        timeControl: TimeControl,
        endGameLogic: EndGameLogic,
        startingTurn: Color = "white"
    ) {
        super();
        this.gameID = gameID;
        this.endGameLogic = endGameLogic;
        this.increment = timeControl.incrementSeconds * 1000;
        this.whiteTimeLeft = timeControl.initialSeconds * 1000;
        this.blackTimeLeft = timeControl.initialSeconds * 1000;
        this.currentTurn = startingTurn;
    }

    //-------------Public API-------------
    /**
     * Bắt đầu timer khi game bắt đầu
     */
    public start(): void {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.turnStartedAt = Date.now();
        this.startTick();

        this.emit("timer_started", this.getState());
    }

    /**
     * Gọi sau mỗi nước đi hợp lệ
     * Cộng increment cho bên vừa đi, chuyển lượt
     */
    public onMovePlayed(nextTurn: Color): void {
        if (!this.isRunning)
            return;

        //trừ thời gian đã dùng cho bên vừa đi
        this.deductElapsedTime();

        //cộng increment (Fischer)
        if (this.currentTurn === "white") {
            this.whiteTimeLeft += this.increment;
        } else {
            this.blackTimeLeft += this.increment;
        }

        //Chuyển lượt
        this.currentTurn = nextTurn;
        this.turnStartedAt = Date.now();

        this.emit("timer_updated", this.getState());
    }

    /**
     * Tạm dừng timer (vd: mất kết nối tạm thời)
     */
    public pause(): void {
        if (!this.isRunning)
            return;
        this.deductElapsedTime();
        this.stopTick();
        this.isRunning = false;

        this.emit("timer_paused", this.getState());
    }

    /**
     * Tiếp tục timer sau khi pause
     */
    public resume(): void {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.turnStartedAt = Date.now();
        this.startTick();

        this.emit("timer_resumed", this.getState());
    }

    /**
     * Dừng timer hẳn (game end)
     */
    public stop(): void {
        this.stopTick();
        this.isRunning = false;
    }

    /**
     * Lấy trạng thái timer hiện tại
     */
    public getState(): TimerState {
        return {
            whiteTimeLeft: this.getRealTimeLeft("white"),
            blackTimeLeft: this.getRealTimeLeft("black"),
            currentTurn: this.currentTurn,
            isRunning: this.isRunning,
        };
    }

    /**
     * Lấy thời gian còn lại (s) để lưu vào db
     */
    public getTimeLeftSeconds(): { white: number; black: number } {
        return {
            white: Math.ceil(this.getRealTimeLeft("white") / 1000),
            black: Math.ceil(this.getRealTimeLeft("black") / 1000),
        };
    }

    //-----------Private Helpers------------
    private startTick(): void {
        this.tickInterval = setInterval(() => {
            this.tick();
        }, GameTimerManagement.TICK_MS);
    }

    private stopTick(): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        this.turnStartedAt = null;
    }

    private tick(): void {
        if (!this.isRunning) 
            return; 

        const timeLeft = this.getRealTimeLeft(this.currentTurn);

        //Emit cập nhật mỗi giây để client hiển thị
        if (Math.floor(timeLeft / 1000) !== Math.floor((timeLeft + GameTimerManagement.TICK_MS) / 1000)) {
            this.emit("timer_tick", this.getState());
        }

        //Hết giờ
        if (timeLeft <= 0) {
            this.handleTimeout();
        }
    }

    private handleTimeout(): void {
        this.stop();

        //Cập nhật thời gian về 0
        if (this.currentTurn === "white") {
            this.whiteTimeLeft = 0;
        } else {
            this.blackTimeLeft = 0;
        }

        const result: GameEndResult = this.endGameLogic.timeout(this.currentTurn);
        this.emit("timeout", { gameID: this.gameID, result, state: this.getState() });
    }

    private deductElapsedTime(): void {
        if (!this.turnStartedAt)
            return;
        
        const elapsed = Date.now() - this.turnStartedAt;

        if (this.currentTurn === "white") {
            this.whiteTimeLeft = Math.max(0, this.whiteTimeLeft - elapsed);
        } else {
            this.blackTimeLeft = Math.max(0, this.blackTimeLeft - elapsed);
        }
    }

    /**
     * Tính thời gian thực còn lại
     */
    private getRealTimeLeft(color: Color): number {
        const stored = color === "white" ? this.whiteTimeLeft : this.blackTimeLeft;

        if (!this.isRunning || color !== this.currentTurn || !this.turnStartedAt) {
            return stored;
        }

        const elapsed = Date.now() - this.turnStartedAt;
        return Math.max(0, stored - elapsed);
    }

    //---------Static Helpers-------------
    /**
     * Tạo TimeControl từ Preset Key
     */
    public static fromPreset(key: string): TimeControl {
        const preset = TIME_CONTROL_PRESETS[key];
        if (!preset) {
            throw new Error(`Unknown time control preset: ${key}`);
        }
        return preset;
    }

    /**
     * Tạo Timecontrol tùy chỉnh
     */
    public static custom(
        type: TimeControlType,
        initialSeconds: number,
        incrementSeconds: number = 0
    ): TimeControl {
        return { type, initialSeconds, incrementSeconds };
    }
}
