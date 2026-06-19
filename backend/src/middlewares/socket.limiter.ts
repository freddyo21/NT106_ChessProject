import { Socket } from "socket.io";

export type SocketRateLimitRule = {
    windowMs: number;
    max: number;
    blockDurationMs?: number;
};

type RateLimitBucket = {
    count: number;
    windowStart: number;
    blockedUntil: number;
    lastSeen: number;
};

type CreateSocketRateLimiterOptions = {
    rules: Record<string, SocketRateLimitRule>;
    keyGenerator?: (socket: Socket, packet: unknown[]) => string;
    onRateLimited?: (
        socket: Socket,
        eventName: string,
        details: {
            retryAfterMs: number;
            rule: SocketRateLimitRule;
        }
    ) => void;
    cleanupIntervalMs?: number;
    idleTtlMs?: number;
};

export const createSocketRateLimiter = ({
    rules,
    keyGenerator = (socket) =>
        String(socket.data?.user?.id ?? socket.handshake.address ?? socket.id),
    onRateLimited,
    cleanupIntervalMs = 60_000,
    idleTtlMs = 10 * 60_000
}: CreateSocketRateLimiterOptions) => {
    const buckets = new Map<string, RateLimitBucket>();

    const cleanupTimer = setInterval(() => {
        const now = Date.now();

        for (const [key, bucket] of buckets.entries()) {
            const isIdle = now - bucket.lastSeen > idleTtlMs;
            const isNotBlocked = bucket.blockedUntil <= now;

            if (isIdle && isNotBlocked) {
                buckets.delete(key);
            }
        }
    }, cleanupIntervalMs);

    cleanupTimer.unref?.();

    const middleware =
        (socket: Socket) =>
            (packet: unknown[], next: (err?: Error) => void): void => {
                const [rawEventName] = packet;
                const eventName = typeof rawEventName === "string" ? rawEventName : "*";
                const rule = rules[eventName] ?? rules["*"];

                if (!rule) {
                    next();
                    return;
                }

                const identity = keyGenerator(socket, packet);
                const ruleKey = rules[eventName] ? eventName : "*";
                const key = `${ruleKey}:${identity}`;
                const now = Date.now();

                const bucket = buckets.get(key);

                if (!bucket) {
                    buckets.set(key, {
                        count: 1,
                        windowStart: now,
                        blockedUntil: 0,
                        lastSeen: now
                    });

                    next();
                    return;
                }

                bucket.lastSeen = now;

                if (bucket.blockedUntil > 0 && now >= bucket.blockedUntil) {
                    bucket.count = 0;
                    bucket.windowStart = now;
                    bucket.blockedUntil = 0;
                }

                if (bucket.blockedUntil > now) {
                    const retryAfterMs = bucket.blockedUntil - now;

                    onRateLimited?.(socket, eventName, { retryAfterMs, rule });

                    const error = new Error("Rate limit exceeded") as Error & {
                        data?: Record<string, unknown>;
                    };
                    error.data = {
                        code: "RATE_LIMIT_EXCEEDED",
                        eventName,
                        retryAfterMs
                    };

                    next(error);
                    return;
                }

                if (now - bucket.windowStart >= rule.windowMs) {
                    bucket.count = 0;
                    bucket.windowStart = now;
                }

                bucket.count += 1;

                if (bucket.count > rule.max) {
                    const retryAfterMs = rule.blockDurationMs ?? rule.windowMs;
                    bucket.blockedUntil = now + retryAfterMs;

                    onRateLimited?.(socket, eventName, { retryAfterMs, rule });

                    const error = new Error("Rate limit exceeded") as Error & {
                        data?: Record<string, unknown>;
                    };
                    error.data = {
                        code: "RATE_LIMIT_EXCEEDED",
                        eventName,
                        retryAfterMs
                    };

                    next(error);
                    return;
                }

                next();
            };

    const destroy = () => {
        clearInterval(cleanupTimer);
    };

    return {
        middleware,
        destroy
    };
};
