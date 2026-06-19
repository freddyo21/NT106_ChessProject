import { Exception } from "./Exception";

export class InvalidCredentialException extends Exception {
    constructor(message: string = "Invalid credentials", details: any = null) {
        super(message, 400, details);
        this.name = "InvalidCredentialException";
    }
}