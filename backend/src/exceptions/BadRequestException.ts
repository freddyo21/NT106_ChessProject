import { Exception } from "./Exception";

export class BadRequestException extends Exception {
    constructor(message = "Bad Request", details: any = null) {
        super(message, 400, details);
        this.name = "BadRequestException";
    }
}