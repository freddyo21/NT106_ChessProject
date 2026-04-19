import { Exception } from "./Exception";

export class TooManyRequestsException extends Exception {
    constructor(message = "Too many requests. Please try again later.", details: any = null) {
        super(message, 429, details);
        this.name = "TooManyRequestsException";
    }
}