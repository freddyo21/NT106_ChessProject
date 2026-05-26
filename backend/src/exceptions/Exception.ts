/**
 * Centralized error handling middleware
 * 
 * - Single source of truth for error responses
 * - Consistent error format for frontend consumption
 * - Differentiates between operational errors and programming errors
 * - Logs detailed errors server-side, sends safe messages to client
 */

export class Exception extends Error {
    protected readonly statusCode: number;
    protected _details: any;
    protected readonly isOperational: boolean;

    constructor(message: string, statusCode = 500, name = "Exception", details: any = null) {
        super(message);
        this.name = name;
        this.statusCode = statusCode;
        this._details = details;
        this.isOperational = true;

        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(this, this.constructor);
        }
    }

    public get details() {
        return this._details;
    }
}