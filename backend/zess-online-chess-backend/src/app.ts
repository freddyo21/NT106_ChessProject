import dotenv from "dotenv";
dotenv.config();

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { errorHandler, notFoundHandler } from "./middlewares/error-handlers";
import { router } from "./routes/router";
import { globalLimiter } from "./middlewares/rate-limiter";
import { createServer } from "node:http";
import { socketInitialize } from "./websocket/websocket";

const app = express();

const httpServer = createServer(app);
socketInitialize(httpServer);

app.set("trust proxy", 1);

/**
 * ---------------------------------------------------------
 * 1. CORS & PARSER
 * ---------------------------------------------------------
 */
const allowedOrigins = (process.env.FRONTEND_CORS_ALLOWED || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., curl, mobile apps, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
    allowedHeaders: [
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
    ],
    // credentials: true, // Remove if not using cookies
    preflightContinue: false,
    optionsSuccessStatus: 200,
};

// Ensure CORS headers (especially credentials) are set for preflight requests
app.options("*", cors(corsOptions));

app.use(cors(corsOptions));

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true }));

/**
 * ---------------------------------------------------------
 * 2. LOGGER (For debugging)
 * ---------------------------------------------------------
 */
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

/**
 * ---------------------------------------------------------
 * 3. PUBLIC ROUTES (No Auth/AppCheck required)
 * ---------------------------------------------------------
 */

// Remove this logic for production
app.get("/", async (req: Request, res: Response) => {
    res.send("Hello World! This is a TypeScript Express Server!");
});

/**
 * ---------------------------------------------------------
 * 4. PROTECTED ROUTES (Require protection)
 * ---------------------------------------------------------
 */

app.use(
    "/api",
    router
);

/**
 * ---------------------------------------------------------
 * 5. ERROR HANDLING (Centralized error handling)
 * ---------------------------------------------------------
 */

// 404 handler for unmatched routes (keeps error handling consistent)
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log("Hệ thống Zess Chess đang chạy tại: " + PORT);
});