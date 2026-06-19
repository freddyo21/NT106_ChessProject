import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { roomManagementSocket, gameplaySocket, chatSocket, matchmakingSocket, lobbySocket, presenceSocket } from "./";
import { Logger } from "../utils/Logger";
import { jwtVerify } from "../auth/jwt-verify";
import { JwtInvalidException } from "../exceptions";
import { createAdapter } from "@socket.io/redis-adapter";
import { createRedisPubSubClients } from "../config/redis.config";

// Track disconnect timeouts to clean up on reconnect
const disconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const getAllowedOrigins = () => {
    const configuredOrigins = (
        process.env.FRONTEND_CORS_ALLOWED_ORIGINS ||
        process.env.FRONTEND_CORS_ALLOWED ||
        ""
    )
        ?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (configuredOrigins?.length) {
        return configuredOrigins;
    }

    return [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:1421",
        "http://127.0.0.1:1421",
    ];
};

export const socketInitialize = async (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: getAllowedOrigins(),
            methods: ["GET", "POST"]
        }
    });

    const logger = new Logger("socket");

    if (process.env.REDIS_ENABLED === "true") {
        const { pubClient, subClient } = await createRedisPubSubClients();
        io.adapter(createAdapter(pubClient, subClient));
        logger.log("Socket.IO Redis adapter enabled");
    }

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new JwtInvalidException("Missing authorization token"));
        }

        try {
            const user = jwtVerify(token);
            const userId =
                typeof user.sub === "string"
                    ? user.sub
                    : (user as { sub?: string }).sub;

            // Validate user ID exists
            if (!userId) {
                return next(new JwtInvalidException("Invalid user ID"));
            }

            socket.data.user = { ...user, id: userId };
            next();
        } catch (err) {
            if (err instanceof JwtInvalidException) {
                return next(err);
            }

            return next(new JwtInvalidException("Invalid token"));
        }
    });

    io.on("connection", (socket: Socket) => {
        const user = socket.data.user;
        const userId = user.id;

        socket.join(`user:${userId}`);
        logger.log("User connected", { socketId: socket.id, userId });

        // Clear any pending disconnect timeout if user reconnects
        if (disconnectTimeouts.has(userId)) {
            clearTimeout(disconnectTimeouts.get(userId)!);
            disconnectTimeouts.delete(userId);
        }

        if (process.env.NODE_ENV !== "production") {
            socket.onAny((eventName, ...args) => {
                logger.debug(`Event: ${eventName}`, ...args);
            });
        }

        gameplaySocket(socket);
        chatSocket(socket);
        lobbySocket(socket);
        matchmakingSocket(socket);
        presenceSocket(socket);
        roomManagementSocket(socket);

        socket.on("disconnect", () => {
            logger.log("User disconnected", { socketId: socket.id, userId });

            const existingTimeout = disconnectTimeouts.get(userId);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }

            // Set timeout to check after 30 seconds if user has any active sockets
            const timeoutId = setTimeout(async () => {
                try {
                    // Check if user still has active connections
                    const activeSockets = await io.in(`user:${userId}`).fetchSockets();

                    if (activeSockets.length === 0) {
                        // User is genuinely offline - emit to other players/friends
                        io.emit("user:status_change", {
                            userId,
                            status: "offline",
                            timestamp: new Date().toISOString()
                        });
                        logger.log("User marked offline", { userId });

                        // TODO: Update database: await userService.setUserOnline(userId, false);
                    } else {
                        logger.log("User reconnected during grace period", { userId });
                    }
                } catch (err) {
                    logger.error("Error checking user sockets", { userId, error: err });
                } finally {
                    disconnectTimeouts.delete(userId);
                }
            }, 30000);

            disconnectTimeouts.set(userId, timeoutId);
        });
    });

    return io;
};
