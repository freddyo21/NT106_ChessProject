import { Exception } from "./Exception";

export class JwtInvalidException extends Exception {
    public statusCode: number;
    public details: any;

    constructor(message: string, statusCode: number = 401, details: any = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}