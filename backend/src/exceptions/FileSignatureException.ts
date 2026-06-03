import { Exception } from "./Exception";

export class FileSignatureException extends Exception {
    constructor(message = "Invalid file signature. The uploaded file may be corrupted or not in the expected format.", details: any = null) {
        super(message, 422, details);
        this.name = "FileSignatureException";
    }
}