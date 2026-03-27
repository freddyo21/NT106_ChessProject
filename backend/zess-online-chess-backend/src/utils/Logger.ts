import fs from "fs";
import path from "path";

type LogLevel = "LOG" | "ERROR" | "DEBUG";

export class Logger {
    private static readonly logDir = path.join(__dirname, "../../logs");
    private static _fileType: string = "";

    private static async ensureLogDir(): Promise<void> {
        await fs.promises.mkdir(this.logDir, { recursive: true });
    }

    private static buildContent(level: LogLevel, message: string, args: unknown[], now: Date): string {
        const timestamp = now.toISOString().replace("T", " ").split(".")[0];
        return `[${timestamp}] [${level}] ${message}${args.length ? ` ${JSON.stringify(args)}` : ""}\n`;
    }

    public static get fileType(): string
    {
        return this._fileType;
    }

    public static set fileType(type: string) {
        this._fileType = type;
    }

    private static getLogPath(level: LogLevel, now: Date): string {
        const date = now.toISOString().split("T")[0];
        const fileName = `zess-${this._fileType}-${level.toLowerCase()}-${date}.log`;
        return path.join(this.logDir, fileName);
    }

    private static async writeToFile(level: LogLevel, message: string, args: unknown[]): Promise<void> {
        const now = new Date();
        const logPath = this.getLogPath(level, now);

        try {
            await this.ensureLogDir();
            const content = this.buildContent(level, message, args, now);
            await fs.promises.appendFile(logPath, content, "utf8");
        } catch {
            process.stderr.write(`Critical: Failed to write log to ${path.basename(logPath)}\n`);
        }
    }

    public static log(message: string, ...args: unknown[]): void {
        void this.writeToFile("LOG", message, args);
        if (process.env.NODE_ENV !== "production") {
            console.log(`[LOG] ${message}`, ...args);
        }
    }

    public static error(message: string, ...args: unknown[]): void {
        void this.writeToFile("ERROR", message, args);
        if (process.env.NODE_ENV !== "production") {
            console.error(`[ERROR] ${message}`, ...args);
        }
    }

    public static debug(message: string, ...args: unknown[]): void {
        void this.writeToFile("DEBUG", message, args);
        if (process.env.NODE_ENV === "development") {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }
}