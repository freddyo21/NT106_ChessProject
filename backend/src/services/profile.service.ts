import { pool } from "../config/db";
import * as gameRepository from "../repositories/game.repository";
import { getPlayerStats } from "./match-history.service";
import { Exception } from "../exceptions";

//---Types----------------

export interface PlayerProfile {
    id: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    isOnline: boolean;
    status: "offline" | "online" | "in_game";
    lastSeenAt: Date | null;
    createdAt: Date;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    gamesPlayed: number;
}

export interface UpdateProfileData {
    username?: string;
    avatarUrl?: string;
    bio?: string;
}

//--------Service Functions--------

/**
 * Lấy profile đầy đủ của 1 người chơi (public)
 */
export const getProfile = async (userId: string): Promise<PlayerProfile | null> => {
    const result = await pool.query(
        `
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
        WHERE u.id = $1
        `,
        [userId]
    );
 
    return result.rows[0] ?? null;
};

/**
 * Lấy profile theo username
 */
export const getProfileByUsername = async (username: string): Promise<PlayerProfile | null> => {
    const result = await pool.query(
        `
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
        WHERE u.username = $1
        `,
        [username]
    );
 
    return result.rows[0] ?? null;
};

/**
 * Cập nhật thông tin profile (chỉ cho phép username, avatar, bio)
 */
export const updateProfile = async (
    userId: string,
    data: UpdateProfileData
): Promise<PlayerProfile> => {
    const { username, avatarUrl, bio } = data;
 
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
 
    if (username !== undefined) {
        // Kiểm tra username đã tồn tại chưa
        const existing = await pool.query(
            `SELECT id FROM users WHERE username = $1 AND id != $2`,
            [username, userId]
        );
        if (existing.rows.length > 0) {
            throw new Exception("Username already taken", 409);
        }
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
 
    if (fields.length === 0) {
        throw new Exception("No fields to update", 400);
    }
 
    fields.push(`updated_at = now()`);
    values.push(userId);
 
    await pool.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`,
        values
    );
 
    const updated = await getProfile(userId);
    if (!updated) throw new Exception("User not found", 404);
    return updated;
};

/**
 * Lấy biểu đồ rating theo thời gian (Dùng cho Profile chart)
 */
export const getRatingChart = async (userId: string, limit = 30) => {
    return gameRepository.getRatingHistory(userId, limit);
};

/**
 * Lấy profile đầy đủ kèm stats (dùng cho profile chính)
 */
export const getFullProfile = async (userId: string) => {
    const [profile, stats] = await Promise.all([
        getProfile(userId),
        getPlayerStats(userId),
    ]);
 
    if (!profile) return null;
 
    return { ...profile, stats };
};

/**
 * Cập nhật trạng thái online của người chơi
 */
export const setOnlineStatus = async (
    userId: string,
    isOnline: boolean
): Promise<void> => {
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

/**
 * Cập nhật status in_game khi bắt đầu / kết thúc ván
 */
export const setInGameStatus = async (
    userId: string,
    inGame: boolean
): Promise<void> => {
    const status = inGame ? "in_game" : "online";
    await pool.query(
        `UPDATE users SET status = $2, updated_at = now() WHERE id = $1`,
        [userId, status]
    );
};

/**
 * Lấy danh sách người chơi đang onl
 */
export const getOnlinePlayers = async (limit = 50) => {
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



