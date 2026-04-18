import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

type LogLevel = "LOG" | "ERROR" | "DEBUG";

export class Logger {
    private __filename = fileURLToPath(import.meta.url);
    private __dirname = path.dirname(this.__filename);

    private readonly logDir = path.join(this.__dirname, "../../logs");
    private _fileType: string;
    
    // Queue for concurrent write handling
    private writeQueue: Map<string, Promise<void>> = new Map();

    constructor(fileType: string = "") {
        this._fileType = fileType;
    }

    private async ensureLogDir(...paths: string[]): Promise<void> {
        await fs.promises.mkdir(path.join(this.logDir, ...paths), { recursive: true });
    }

    private buildContent(level: LogLevel, message: string, args: unknown[], now: Date) {
        const sensitiveKeys = ["password", "token", "secret", "authorization"];

        // Mask sensitive fields in args
        const maskSensitiveData = (obj: any): any => {
            // Kiểm tra cơ bản và xử lý các kiểu dữ liệu không phải object/null
            if (typeof obj !== "object" || obj === null) return obj;

            // Xử lý Date để tránh biến nó thành object thường
            if (obj instanceof Date) return obj;

            // Xử lý mảng
            if (Array.isArray(obj)) return obj.map(maskSensitiveData);

            const masked: any = {};
            for (const key of Object.keys(obj)) {
                const val = obj[key];

                // Kiểm tra key nhạy cảm (Case-insensitive)
                if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
                    masked[key] = "***MASKED***";
                } else if (typeof val === "object" && val !== null) {
                    // Đệ quy cho object con
                    masked[key] = maskSensitiveData(val);
                } else {
                    masked[key] = val;
                }
            }
            return masked;
        };

        const processedDetails = args.map(arg => {
            let detail = arg;
            if (arg instanceof Error) {
                detail = {
                    error_message: arg.message || "No message provided",
                    stack: arg.stack?.split("\n").map(line => line.trim()) || [],
                    // Chỉ lấy các thuộc tính enumerable của Error
                    ...arg, // Có thể có các thuộc tính custom như message, code, etc.
                };
            }
            // QUAN TRỌNG: Mọi dữ liệu (kể cả Error đã format) đều phải qua mask
            return maskSensitiveData(detail);
        });

        // Extract IP safely - take first found IP from args
        let ip: unknown;
        for (const arg of args) {
            if (arg && typeof arg === "object" && "ip" in arg) {
                ip = arg.ip;
                break;
            }
        }

        const logObject = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ip,
            details: processedDetails,
            fileType: this._fileType
        };
        return logObject;
    }

    public get fileType(): string {
        return this._fileType;
    }

    public set fileType(type: string) {
        this._fileType = type;
    }

    private getDatePath(now: Date): string {
        const date = now.getDate().toString().padStart(2, "0");
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const year = now.getFullYear().toString();
        return path.join(year, month, date);
    }

    private getLogPath(level: LogLevel, now: Date): string {
        const prefix = this._fileType ? `${this._fileType}-` : "";
        // Changed to JSONL format (JSON Lines) - one entry per line
        const fileName = `${prefix}${level.toLowerCase()}.log.jsonl`;
        return path.join(this.logDir, this.getDatePath(now), fileName);
    }

    private async writeToFile(level: LogLevel, message: string, args: unknown[]): Promise<void> {
        const now = new Date();
        const logPath = this.getLogPath(level, now);
        const datePath = this.getDatePath(now);

        try {
            await this.ensureLogDir(datePath);
            const newEntry = this.buildContent(level, message, args, now);

            // Queue writes to same file to prevent race conditions
            let currentQueue = this.writeQueue.get(logPath) || Promise.resolve();
            
            const writePromise = currentQueue.then(async () => {
                try {
                    // Use appendFile instead of read-modify-write
                    // JSONL format: each line is a complete JSON object
                    const logLine = JSON.stringify(newEntry) + "\n";
                    await fs.promises.appendFile(logPath, logLine, "utf8");
                } catch (error) {
                    const reason = error instanceof Error ? error.message : String(error);
                    process.stderr.write(
                        `Critical: Failed to write log to ${path.basename(logPath)} - ${reason}\n`
                    );
                    throw error;
                }
            });

            this.writeQueue.set(logPath, writePromise);
            await writePromise;

        } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);
            process.stderr.write(
                `Critical: Failed to write log to ${path.basename(logPath)} - ${reason}\n`
            );
        }
    }

    public log(message: string, ...args: unknown[]): void {
        if (process.env.NODE_ENV !== "production") {
            console.log(`[LOG] ${message}`, ...args);
        }
        this.writeToFile("LOG", message, args).catch(err => {
            process.stderr.write(`Unhandled error in Logger.log: ${err instanceof Error ? err.message : String(err)}\n`);
        });
    }

    public error(message: string, ...args: unknown[]): void {
        if (process.env.NODE_ENV !== "production") {
            console.error(`[ERROR] ${message}`, ...args);
        }
        this.writeToFile("ERROR", message, args).catch(err => {
            process.stderr.write(`Unhandled error in Logger.error: ${err instanceof Error ? err.message : String(err)}\n`);
        });
    }

    public debug(message: string, ...args: unknown[]): void {
        if (process.env.NODE_ENV === "development") {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
        this.writeToFile("DEBUG", message, args).catch(err => {
            process.stderr.write(`Unhandled error in Logger.debug: ${err instanceof Error ? err.message : String(err)}\n`);
        });
    }
}