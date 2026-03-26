/**
 * Centralized error handling middleware
 * 
 * - Single source of truth for error responses
 * - Consistent error format for frontend consumption
 * - Differentiates between operational errors and programming errors
 * - Logs detailed errors server-side, sends safe messages to client
 */

export class Exception extends Error {
    public statusCode: number;
    public details: any;
    public isOperational: boolean;

    constructor(message: string, statusCode = 500, details: any = null) {
        super(message);

        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;

        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(this, this.constructor);
        }
    }
}