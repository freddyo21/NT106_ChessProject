import { pool } from "../config/database.config";
import type {
    LeaderboardEntry,
    LeaderboardOptions,
} from "../types/LeaderBoard";
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
        WITH game_stats AS (
            SELECT
                u.id AS user_id,
                COUNT(g.id)::int AS games_played
            FROM users u
            LEFT JOIN games g
                ON g.status = 'finished'
                AND (g.white_player_id = u.id OR g.black_player_id = u.id)
            GROUP BY u.id
        )
        SELECT COUNT(*) AS count
        FROM users u
        LEFT JOIN player_ratings pr ON pr.user_id = u.id
        LEFT JOIN game_stats gs ON gs.user_id = u.id
        WHERE GREATEST(COALESCE(gs.games_played, 0), COALESCE(pr.games_played, 0)) >= $1
        `,
        [minGamesPlayed]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
 
    const result = await pool.query<LeaderboardEntry>(
        `
        WITH game_stats AS (
            SELECT
                u.id AS user_id,
                COUNT(g.id)::int AS games_played,
                COUNT(g.id) FILTER (
                    WHERE (g.white_player_id = u.id AND g.result = 'white_win')
                       OR (g.black_player_id = u.id AND g.result = 'black_win')
                )::int AS wins,
                COUNT(g.id) FILTER (
                    WHERE (g.white_player_id = u.id AND g.result = 'black_win')
                       OR (g.black_player_id = u.id AND g.result = 'white_win')
                )::int AS losses,
                COUNT(g.id) FILTER (WHERE g.result = 'draw')::int AS draws
            FROM users u
            LEFT JOIN games g
                ON g.status = 'finished'
                AND (g.white_player_id = u.id OR g.black_player_id = u.id)
            GROUP BY u.id
        )
        SELECT
            ROW_NUMBER() OVER (ORDER BY COALESCE(pr.rating, u.elo, 1200) DESC) AS rank,
            u.id            AS "userId",
            u.username,
            u.avatar_url    AS "avatarUrl",
            COALESCE(pr.rating, u.elo, 1200) AS rating,
            GREATEST(COALESCE(gs.wins, 0), COALESCE(pr.wins, 0)) AS wins,
            GREATEST(COALESCE(gs.losses, 0), COALESCE(pr.losses, 0)) AS losses,
            GREATEST(COALESCE(gs.draws, 0), COALESCE(pr.draws, 0)) AS draws,
            GREATEST(COALESCE(gs.games_played, 0), COALESCE(pr.games_played, 0)) AS "gamesPlayed",
            CASE
                WHEN GREATEST(COALESCE(gs.games_played, 0), COALESCE(pr.games_played, 0)) = 0 THEN 0
                ELSE ROUND(
                    (GREATEST(COALESCE(gs.wins, 0), COALESCE(pr.wins, 0))::numeric
                    / GREATEST(COALESCE(gs.games_played, 0), COALESCE(pr.games_played, 0))) * 100,
                    1
                )
            END AS "winRate"
        FROM users u
        LEFT JOIN player_ratings pr ON pr.user_id = u.id
        LEFT JOIN game_stats gs ON gs.user_id = u.id
        WHERE GREATEST(COALESCE(gs.games_played, 0), COALESCE(pr.games_played, 0)) >= $1
        ORDER BY COALESCE(pr.rating, u.elo, 1200) DESC
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
