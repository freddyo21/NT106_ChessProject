import { pool } from "../config/database.config";
import type { MatchHistoryItem, MatchHistoryOptions } from "../types/MatchHistory";

export const findMatchHistoryByUserId = async (
    userId: string,
    options: MatchHistoryOptions = {}
): Promise<{ items: MatchHistoryItem[]; total: number }> => {
    const { limit = 20, offset = 0, timeControlType } = options;
    const conditions: string[] = [
        "(g.white_player_id = $1 OR g.black_player_id = $1)",
        "g.status = $2",
    ];
    const values: unknown[] = [userId, "finished"];
    let idx = 3;

    if (timeControlType) {
        conditions.push(`g.time_control_type = $${idx++}`);
        values.push(timeControlType);
    }

    const whereClause = conditions.join(" AND ");
    const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM games g WHERE ${whereClause}`,
        values
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    const query = `
        SELECT
            g.id                        AS "gameId",
            CASE WHEN g.white_player_id = $1 THEN g.black_player_id
                 ELSE g.white_player_id END AS "opponentId",
            CASE WHEN g.white_player_id = $1 THEN u_black.username
                 ELSE u_white.username END  AS "opponentUsername",
            CASE WHEN g.white_player_id = $1 THEN u_black.avatar_url
                 ELSE u_white.avatar_url END AS "opponentAvatar",
            CASE WHEN g.white_player_id = $1 THEN g.black_rating_snapshot
                 ELSE g.white_rating_snapshot END AS "opponentRatingAtGame",
            CASE WHEN g.white_player_id = $1 THEN 'white' ELSE 'black' END AS "playerColor",
            CASE
                WHEN g.result = 'draw'                                     THEN 'draw'
                WHEN (g.white_player_id = $1 AND g.result = 'white_win')   THEN 'win'
                WHEN (g.black_player_id = $1 AND g.result = 'black_win')   THEN 'win'
                ELSE 'loss'
            END AS result,
            g.result                    AS "gameResult",
            g.termination_reason        AS "terminationReason",
            g.time_control_type         AS "timeControlType",
            g.initial_time_seconds      AS "initialTimeSeconds",
            g.increment_seconds         AS "incrementSeconds",
            g.move_count                AS "moveCount",
            rh.rating_before            AS "ratingBefore",
            rh.rating_after             AS "ratingAfter",
            rh.rating_change            AS "ratingChange",
            g.started_at                AS "startedAt",
            g.ended_at                  AS "endedAt",
            EXTRACT(EPOCH FROM (g.ended_at - g.started_at))::int AS "durationSeconds"
        FROM games g
        LEFT JOIN users u_white ON u_white.id = g.white_player_id
        LEFT JOIN users u_black ON u_black.id = g.black_player_id
        LEFT JOIN rating_history rh ON rh.game_id = g.id AND rh.user_id = $1
        WHERE ${whereClause}
        ORDER BY g.ended_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
    `;

    values.push(limit, offset);
    const result = await pool.query<MatchHistoryItem>(query, values);

    return { items: result.rows, total };
};

export const getPlayerStats = async (userId: string) => {
    const result = await pool.query(
        `
        SELECT
            COUNT(*)                                            AS "totalGames",
            COUNT(*) FILTER (WHERE result = 'white_win' AND white_player_id = $1)
            + COUNT(*) FILTER (WHERE result = 'black_win' AND black_player_id = $1)
                                                                AS wins,
            COUNT(*) FILTER (WHERE result = 'black_win' AND white_player_id = $1)
            + COUNT(*) FILTER (WHERE result = 'white_win' AND black_player_id = $1)
                                                                AS losses,
            COUNT(*) FILTER (WHERE result = 'draw')             AS draws,
            AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))::int AS "avgDurationSeconds",
            AVG(move_count)::int                                AS "avgMoveCount"
        FROM games
        WHERE (white_player_id = $1 OR black_player_id = $1)
          AND status = 'finished'
        `,
        [userId]
    );

    return result.rows[0] ?? null;
};
