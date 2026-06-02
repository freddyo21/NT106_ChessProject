import { pool } from "../config/database.config";
import type { PlayerProfile, UpdateProfileData } from "../types/Profile";

const PROFILE_SELECT = `
    SELECT
        u.id,
        u.username,
        u.avatar_url        AS "avatarUrl",
        u.bio,
        u.is_online         AS "isOnline",
        u.status,
        u.last_seen_at      AS "lastSeenAt",
        u.created_at        AS "createdAt",
        COALESCE(pr.rating, 1200)       AS rating,
        COALESCE(pr.wins, 0)            AS wins,
        COALESCE(pr.losses, 0)          AS losses,
        COALESCE(pr.draws, 0)           AS draws,
        COALESCE(pr.games_played, 0)    AS "gamesPlayed"
    FROM users u
    LEFT JOIN player_ratings pr ON pr.user_id = u.id
`;

export const findProfileById = async (userId: string): Promise<PlayerProfile | null> => {
    const result = await pool.query<PlayerProfile>(
        `${PROFILE_SELECT} WHERE u.id = $1`,
        [userId]
    );

    return result.rows[0] ?? null;
};

export const findProfileByUsername = async (username: string): Promise<PlayerProfile | null> => {
    const result = await pool.query<PlayerProfile>(
        `${PROFILE_SELECT} WHERE u.username = $1`,
        [username]
    );

    return result.rows[0] ?? null;
};

export const isUsernameTakenByAnotherUser = async (username: string, userId: string): Promise<boolean> => {
    const result = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username, userId]
    );

    return result.rows.length > 0;
};

export const updateProfileFields = async (userId: string, data: UpdateProfileData): Promise<void> => {
    const { username, avatarUrl, bio } = data;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (username !== undefined) {
        fields.push(`username = $${idx++}`);
        values.push(username);
    }

    if (avatarUrl !== undefined) {
        fields.push(`avatar_url = $${idx++}`);
        values.push(avatarUrl);
    }

    if (bio !== undefined) {
        fields.push(`bio = $${idx++}`);
        values.push(bio);
    }

    fields.push("updated_at = now()");
    values.push(userId);

    await pool.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`,
        values
    );
};

export const updateOnlineStatus = async (userId: string, isOnline: boolean): Promise<void> => {
    const status = isOnline ? "online" : "offline";
    await pool.query(
        `
        UPDATE users SET
            is_online    = $2,
            status       = $3,
            last_seen_at = CASE WHEN $2 = false THEN now() ELSE last_seen_at END,
            updated_at   = now()
        WHERE id = $1
        `,
        [userId, isOnline, status]
    );
};

export const updateInGameStatus = async (userId: string, inGame: boolean): Promise<void> => {
    const status = inGame ? "in_game" : "online";
    await pool.query(
        "UPDATE users SET status = $2, updated_at = now() WHERE id = $1",
        [userId, status]
    );
};

export const findOnlinePlayers = async (limit = 50) => {
    const result = await pool.query(
        `
        SELECT
            u.id,
            u.username,
            u.avatar_url    AS "avatarUrl",
            u.status,
            COALESCE(pr.rating, 1200) AS rating
        FROM users u
        LEFT JOIN player_ratings pr ON pr.user_id = u.id
        WHERE u.is_online = true
        ORDER BY pr.rating DESC NULLS LAST
        LIMIT $1
        `,
        [limit]
    );

    return result.rows;
};
