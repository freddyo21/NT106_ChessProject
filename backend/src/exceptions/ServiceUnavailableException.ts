import { Exception } from "./Exception";

export class ServiceUnavailableException  extends Exception {
    constructor(message = "Service is currently unavailable. Please try again later.", details: any = null) {
        super(message, 503, details);
        this.name = "ServiceUnavailableException";
    }
}