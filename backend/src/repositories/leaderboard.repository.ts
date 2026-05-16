import { pool } from "../config/db";

//-------Types--------

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    avatarUrl: string | null;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    gamesPlayed: number;
    winRate: number;
}
 
export interface LeaderboardOptions {
    limit?: number;
    offset?: number;
    minGamesPlayed?: number;
}

//-------Repository Functions---------

/**
 * Lấy bảng xếp hạng toàn server, sort theo rating DESC
 */
export const getLeaderboard = async (
    options: LeaderboardOptions = {}
): Promise<{ entries: LeaderboardEntry[]; total: number }> => {
    const { limit = 50, offset = 0, minGamesPlayed = 1 } = options;
 
    const countResult = await pool.query<{ count: string }>(
        `
        SELECT COUNT(*) AS count
        FROM player_ratings pr
        JOIN users u ON u.id = pr.user_id
        WHERE pr.games_played >= $1
        `,
        [minGamesPlayed]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
 
    const result = await pool.query<LeaderboardEntry>(
        `
        SELECT
            ROW_NUMBER() OVER (ORDER BY pr.rating DESC) AS rank,
            u.id            AS "userId",
            u.username,
            u.avatar_url    AS "avatarUrl",
            pr.rating,
            pr.wins,
            pr.losses,
            pr.draws,
            pr.games_played AS "gamesPlayed",
            CASE
                WHEN pr.games_played = 0 THEN 0
                ELSE ROUND((pr.wins::numeric / pr.games_played) * 100, 1)
            END AS "winRate"
        FROM player_ratings pr
        JOIN users u ON u.id = pr.user_id
        WHERE pr.games_played >= $1
        ORDER BY pr.rating DESC
        LIMIT $2 OFFSET $3
        `,
        [minGamesPlayed, limit, offset]
    );
 
    return { entries: result.rows, total };
};

/**
 * Lấy rank của một người chơi cụ thể
 */
export const getPlayerRank = async (userId: string): Promise<number | null> => {
    const result = await pool.query<{ rank: string }>(
        `
        SELECT rank FROM (
            SELECT
                user_id,
                ROW_NUMBER() OVER (ORDER BY rating DESC) AS rank
            FROM player_ratings
            WHERE games_played >= 1
        ) ranked
        WHERE user_id = $1
        `,
        [userId]
    );
 
    return result.rows[0] ? parseInt(result.rows[0].rank, 10) : null;
};

/**
 * Lấy top N người chơi xung quanh 1 rating (dùng cho matchmaking display)
 */
export const getNearbyPlayers = async (
    userId: string,
    range = 5
): Promise<LeaderboardEntry[]> => {
    const result = await pool.query<LeaderboardEntry>(
        `
        WITH ranked AS (
            SELECT
                ROW_NUMBER() OVER (ORDER BY pr.rating DESC) AS rank,
                u.id            AS "userId",
                u.username,
                u.avatar_url    AS "avatarUrl",
                pr.rating,
                pr.wins,
                pr.losses,
                pr.draws,
                pr.games_played AS "gamesPlayed",
                CASE
                    WHEN pr.games_played = 0 THEN 0
                    ELSE ROUND((pr.wins::numeric / pr.games_played) * 100, 1)
                END AS "winRate"
            FROM player_ratings pr
            JOIN users u ON u.id = pr.user_id
            WHERE pr.games_played >= 1
        ),
        my_rank AS (
            SELECT rank FROM ranked WHERE "userId" = $1
        )
        SELECT r.*
        FROM ranked r, my_rank mr
        WHERE r.rank BETWEEN GREATEST(1, mr.rank - $2) AND mr.rank + $2
        ORDER BY r.rank ASC
        `,
        [userId, range]
    );
 
    return result.rows;
};