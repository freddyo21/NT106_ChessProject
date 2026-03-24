import { Exception } from "./Exception";

export class ConflictException extends Exception {
    public statusCode: number;
    public details: any;

    constructor(message: string, details: any = null) {
        super(message);
        this.statusCode = 409;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}