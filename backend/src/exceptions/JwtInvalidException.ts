import { Exception } from "./Exception";

export class JwtInvalidException extends Exception {
    constructor(message: string = "Invalid token", statusCode: number = 401, details: any = null) {
        super(message, statusCode, details);
        this.name = "JwtInvalidException";
    }
}