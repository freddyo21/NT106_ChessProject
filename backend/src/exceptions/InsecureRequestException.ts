import { Exception } from "./Exception";

export class InsecureRequestException extends Exception {
    constructor(message = "Insecure request. Please ensure your request is made over HTTPS and does not contain any potentially harmful content.", details: any = null) {
        super(message, 403, details);
        this.name = "InsecureRequestException";
    }
}