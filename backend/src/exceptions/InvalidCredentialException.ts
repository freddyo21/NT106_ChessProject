import { Exception } from "./Exception";

export class InvalidCredentialException extends Exception {
    constructor(message: string = "Unauthorized access", details: any = null) {
        super(message, 401, details);
        this.name = "InvalidCredentialException";
    }
}