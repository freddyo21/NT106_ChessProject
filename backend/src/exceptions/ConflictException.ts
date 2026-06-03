import { Exception } from "./Exception";

export class ConflictException extends Exception {
    constructor(message: string = "Resource conflict", details: any = null) {
        super(message, 409, details);
        this.name = "ConflictException";
    }
}