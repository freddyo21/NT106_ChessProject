import { Exception } from "./Exception";

export class NotFoundException extends Exception {
    constructor(message = "Resource not found", details: any = null) {
        super(message, 404, details);
        this.name = "NotFoundException";
    }
}