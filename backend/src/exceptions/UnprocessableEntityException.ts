import { Exception } from "./Exception";

export class UnprocessableEntityException extends Exception {
    constructor(message = "Data format is invalid for processing", details: any = null) {
        super(message, 422, details);
        this.name = "UnprocessableEntityException";
    }
}