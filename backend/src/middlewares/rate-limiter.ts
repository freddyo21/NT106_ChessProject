import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "You have been sent too many requests. Try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429
});