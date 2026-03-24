import { Exception } from "./Exception";

export class InvalidCredentialException extends Exception {
    public statusCode: number;
    public details: any;

    constructor(message: string, details: any = null) {
        super(message);
        this.statusCode = 401; // Unauthorized
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}