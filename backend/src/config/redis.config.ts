import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = createClient({
    url: redisUrl,
});

redisClient.on("error", (error) => {
    console.error("[Redis] Client error:", error);
});

let redisConnectPromise: Promise<void> | null = null;

export const connectRedis = async (): Promise<void> => {
    if (redisClient.isOpen) {
        return;
    }

    if (!redisConnectPromise) {
        redisConnectPromise = redisClient
            .connect()
            .then(() => {
                console.log("[Redis] Connected");
            })
            .finally(() => {
                redisConnectPromise = null;
            });
    }

    await redisConnectPromise;
};

export const disconnectRedis = async (): Promise<void> => {
    if (redisClient.isOpen) {
        await redisClient.quit();
        console.log("[Redis] Disconnected");
    }
};

export const createRedisPubSubClients = async () => {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (error) => {
        console.error("[Redis] Pub client error:", error);
    });

    subClient.on("error", (error) => {
        console.error("[Redis] Sub client error:", error);
    });

    await Promise.all([
        pubClient.connect(),
        subClient.connect(),
    ]);

    return {
        pubClient,
        subClient,
    };
};