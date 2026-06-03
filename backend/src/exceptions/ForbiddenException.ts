import { Exception } from "./Exception";

export class ForbiddenException extends Exception {
    constructor(message = "You do not have permission to perform this action", details: any = null) {
        super(message, 403, details);
        this.name = "ForbiddenException";
    }
}