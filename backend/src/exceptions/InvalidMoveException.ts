import { Exception } from "./Exception";

export class InvalidMoveException extends Exception {
    constructor(message: string = "Invalid move", details: any = null) {
        super(message, 400, details);
        this.name = "InvalidMoveException";
    }
}