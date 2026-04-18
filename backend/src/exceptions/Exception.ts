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
    protected details: any;
    protected readonly isOperational: boolean;

    constructor(message: string, statusCode = 500, details: any = null) {
        super(message);
        this.name = "Exception";
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true; // Distinguishes from programming errors
        Error.captureStackTrace(this, this.constructor);
    }
}