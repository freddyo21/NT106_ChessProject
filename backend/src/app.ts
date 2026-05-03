import "dotenv/config";

import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import compression from "compression";
import { errorHandler, notFoundHandler } from "./middlewares/error-handlers";
import { router } from "./routes/router";
import { globalLimiter } from "./middlewares/rate-limiter";
import helmet from "helmet";
import { socketInitialize } from "./websocket";
import { createServer } from "http";
import { Server as HttpServer } from "http";

// Store server reference for graceful shutdown
let httpServer: HttpServer | null = null;

async function initializeApp() {
    const app = express();

    setupMiddleware(app);
    setupRoutes(app);
    setupErrorHandling(app);

    httpServer = createServer(app);
    await socketInitialize(httpServer);

    const PORT = process.env.PORT || 3000;
    return new Promise<void>((resolve, reject) => {
        httpServer!.listen(PORT, () => {
            console.log(`Zess Chess System is running on port ${PORT}`);
            resolve();
        }).on("error", (err: any) => {
            if (err.code === "EADDRINUSE") {
                console.error(`[FATAL] Port ${PORT} is already in use!`);
                console.error("Run 'taskkill /F /IM node.exe /T' to free up the port.");
                process.exit(1);
            }
            console.error("Failed to start server:", err);
            reject(err);
        });
    });
}

initializeApp().catch(err => {
    console.error("Failed to start app:", err);
    process.exit(1);
});

/**
 * ═══════════════════════════════════════════════════════════
 * GRACEFUL SHUTDOWN HANDLER
 * ═══════════════════════════════════════════════════════════
 */
function setupGracefulShutdown() {
    const signals = ["SIGTERM", "SIGINT"];

    signals.forEach(signal => {
        process.on(signal, async () => {
            console.log(`\n📛 Received ${signal}, starting graceful shutdown...`);

            if (!httpServer) {
                console.log("Server not initialized, exiting immediately");
                process.exit(0);
            }

            // 1. Stop accepting new connections
            httpServer.close(() => {
                console.log("✅ HTTP server closed, no new connections accepted");
            });

            // 2. Graceful disconnect timeout (30 seconds)
            const shutdownTimeout = setTimeout(() => {
                console.error("❌ Graceful shutdown timeout exceeded, forcing exit...");
                process.exit(1);
            }, 30000);

            // 3. Wait for all connections to close
            // Socket.io will handle its own connection cleanup
            httpServer.once("close", () => {
                clearTimeout(shutdownTimeout);
                console.log("✅ All connections closed, shutting down gracefully");

                // TODO: Add your cleanup here
                // await database.disconnect();
                // await redis.disconnect();

                process.exit(0);
            });

            // 4. Force close connections that don't close in time
            setTimeout(() => {
                if (httpServer && httpServer.listening) {
                    console.warn("⚠️  Some connections still open, destroying them...");
                    httpServer.closeAllConnections?.();
                }
            }, 25000);
        });
    });
}

setupGracefulShutdown();

function setupMiddleware(app: Application) {
    app.set("trust proxy", 1);
    app.use(helmet());

    /**
     * ---------------------------------------------------------
     * 1. CORS & PARSER
     * ---------------------------------------------------------
     */
    const allowedOrigins = (process.env.FRONTEND_CORS_ALLOWED_ORIGINS || "")
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
        preflightContinue: false,
        optionsSuccessStatus: 204,
    };

    // Ensure CORS headers (especially credentials) are set for preflight requests
    app.options(/(.*)/, cors(corsOptions));
    app.use(cors(corsOptions));
    app.use(compression());
    app.use(express.json({ limit: "50kb" }));

    /**
     * ---------------------------------------------------------
     * 2. LOGGER (For debugging)
     * ---------------------------------------------------------
     */
    app.use((req: Request, res: Response, next: NextFunction) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

function setupRoutes(app: Application) {
    /**
     * ---------------------------------------------------------
     * 3. PUBLIC ROUTES (No need for protection)
     * ---------------------------------------------------------
     */

    // Remove this logic for production
    app.get("/", (req: Request, res: Response) => res.send("Hello World!"));

    /**
     * ---------------------------------------------------------
     * 4. PROTECTED ROUTES (Require protection)
     * ---------------------------------------------------------
     */
    app.use("/api/v1", globalLimiter, router);

    /** This is the place where updated version codes run */
    // app.use(
    //     "/api/v2",
    //     globalLimiter,
    //     router
    // );

    // app.use(
    //     "/api/v3",
    //     globalLimiter,
    //     router
    // );
}


/**
 * ---------------------------------------------------------
 * 5. ERROR HANDLING (Centralized error handling)
 * ---------------------------------------------------------
 */
function setupErrorHandling(app: Application) {
    app.use(notFoundHandler);

    // Global error handler
    app.use(errorHandler);
}