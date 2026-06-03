import { Exception } from "./Exception";

export class PayloadTooLargeException extends Exception {
    constructor(message = "Payload too large. Please reduce the size of your request.", details: any = null) {
        super(message, 413, details);
        this.name = "PayloadTooLargeException";
    }
}