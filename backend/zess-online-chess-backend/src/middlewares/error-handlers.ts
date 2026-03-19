import { Request, Response, NextFunction } from "express";
import { Exception } from "../exceptions/Exception";

/**
 * Global error handler - must be registered after all routes
 */

export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // Log the full error for debugging
    console.error("Error caught by global handler:", {
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
    });

    // Default to 500 if no status code
    const statusCode = err.statusCode || 500;

    // Send structured error response
    res.status(statusCode).json({
        error: {
            message: err.message || "Internal server error",
            status: statusCode,
            ...(err.details && { details: err.details }),
            // In production, you"d hide stack traces
            ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        },
    });
}

/**
 * Async route wrapper - catches promise rejections automatically
 * Usage: router.get("/", asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 404 handler - catches all unmatched routes
 */
export function notFoundHandler(
    req: Request,
    res: Response,
    next: NextFunction
) {
    next(new Exception(`Route not found: ${req.method} ${req.path}`, 404));
}
