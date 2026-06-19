import { pool } from "../config/database.config";
import type { MatchmakingMode, QueueEntry } from "../types/MatchMaking";
import type { TimeControlType } from "../types/TimeControl";

export const upsertQueueEntry = async (
    userId: string,
    mode: MatchmakingMode,
    timeControlType: TimeControlType,
    currentRating: number
): Promise<void> => {
    await pool.query(
        `
        INSERT INTO matchmaking_queue (user_id, mode, time_control_type, rating_at_queue)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
            mode                = EXCLUDED.mode,
            time_control_type   = EXCLUDED.time_control_type,
            rating_at_queue     = EXCLUDED.rating_at_queue,
            created_at          = now()
        `,
        [userId, mode, timeControlType, currentRating]
    );
};

export const deleteQueueEntry = async (userId: string): Promise<void> => {
    await pool.query(
        "DELETE FROM matchmaking_queue WHERE user_id = $1",
        [userId]
    );
};

export const hasQueueEntry = async (userId: string): Promise<boolean> => {
    const result = await pool.query(
        "SELECT 1 FROM matchmaking_queue WHERE user_id = $1",
        [userId]
    );

    return result.rows.length > 0;
};

export const findQueueEntry = async (userId: string): Promise<QueueEntry | null> => {
    const result = await pool.query<QueueEntry>(
        `
        SELECT
            user_id           AS "userId",
            mode,
            time_control_type AS "timeControlType",
            rating_at_queue   AS "ratingAtQueue",
            created_at        AS "createdAt"
        FROM matchmaking_queue
        WHERE user_id = $1
        `,
        [userId]
    );

    return result.rows[0] ?? null;
};

export const findOpponent = async (
    userId: string,
    mode: MatchmakingMode,
    timeControlType: TimeControlType
): Promise<QueueEntry | null> => {
    const result = await pool.query<QueueEntry>(
        `
        SELECT
            user_id             AS "userId",
            mode,
            time_control_type   AS "timeControlType",
            rating_at_queue     AS "ratingAtQueue",
            created_at          AS "createdAt"
        FROM matchmaking_queue
        WHERE user_id != $1
            AND mode = $2
            AND time_control_type = $3
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        `,
        [userId, mode, timeControlType]
    );

    return result.rows[0] ?? null;
};

export const isRoomCodeTaken = async (roomCode: string): Promise<boolean> => {
    const result = await pool.query(
        "SELECT 1 FROM games WHERE room_code = $1",
        [roomCode]
    );

    return result.rows.length > 0;
};

export const deleteQueueEntries = async (userIds: string[]): Promise<void> => {
    await pool.query(
        "DELETE FROM matchmaking_queue WHERE user_id = ANY($1::uuid[])",
        [userIds]
    );
};

export const getQueueStats = async () => {
    const result = await pool.query(
        `
        SELECT
            time_control_type   AS "timeControlType",
            mode,
            COUNT(*)            AS count
        FROM matchmaking_queue
        GROUP BY time_control_type, mode
        ORDER BY time_control_type, mode
        `
    );

    return result.rows;
};
