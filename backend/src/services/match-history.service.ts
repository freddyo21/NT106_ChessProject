import * as gameRepository from "../repositories/game.repository";
import { pool } from "../config/db";

//-----Types---------
export interface MatchHistoryItem {
    gameId: string;
    opponentId: string;
    opponentUsername: string;
    opponentAvatar: string | null;
    opponentRatingAtGame: number | null;
    playerColor: "white" | "black";
    result: "win" | "loss" | "draw";
    gameResult: gameRepository.GameResult;
    terminationReason: gameRepository.TerminationReason | null;
    timeControlType: string;
    initialTimeSeconds: number;
    incrementSeconds: number;
    moveCount: number;
    ratingBefore: number | null;
    ratingAfter: number | null;
    ratingChange: number | null;
    startedAt: Date | null;
    endedAt: Date | null;
    durationSeconds: number | null;
}

export interface MatchHistoryOptions {
    limit?: number;
    offset?: number;
    timeControlType?: string;
}

//------Servicfe Functions------

/**
 * Lấy lịch sử trận đấu của một người chơi
 */
export const getMatchHistory = async (
    userId: string,
    options: MatchHistoryOptions = {}
): Promise<{ items: MatchHistoryItem[]; total: number }> => {
    const { limit = 20, offset = 0, timeControlType } = options;
 
    const conditions: string[] = [
        `(g.white_player_id = $1 OR g.black_player_id = $1)`,
        `g.status = 'finished'`,
    ];
    const values: unknown[] = [userId];
    let idx = 2;
 
    if (timeControlType) {
        conditions.push(`g.time_control_type = $${idx++}`);
        values.push(timeControlType);
    }

    const whereClause = conditions.join(" AND ");

    // Count total
    const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM games g WHERE ${whereClause}`,
        values
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    //Fetch items
    const query = `
        SELECT
            g.id                        AS "gameId",
 
            -- Opponent info
            CASE WHEN g.white_player_id = $1 THEN g.black_player_id
                 ELSE g.white_player_id END AS "opponentId",
            CASE WHEN g.white_player_id = $1 THEN u_black.username
                 ELSE u_white.username END  AS "opponentUsername",
            CASE WHEN g.white_player_id = $1 THEN u_black.avatar_url
                 ELSE u_white.avatar_url END AS "opponentAvatar",
            CASE WHEN g.white_player_id = $1 THEN g.black_rating_snapshot
                 ELSE g.white_rating_snapshot END AS "opponentRatingAtGame",
 
            -- Player color & result
            CASE WHEN g.white_player_id = $1 THEN 'white' ELSE 'black' END AS "playerColor",
            CASE
                WHEN g.result = 'draw'                                     THEN 'draw'
                WHEN (g.white_player_id = $1 AND g.result = 'white_win')   THEN 'win'
                WHEN (g.black_player_id = $1 AND g.result = 'black_win')   THEN 'win'
                ELSE 'loss'
            END AS result,
            g.result                    AS "gameResult",
            g.termination_reason        AS "terminationReason",
 
            -- Time control
            g.time_control_type         AS "timeControlType",
            g.initial_time_seconds      AS "initialTimeSeconds",
            g.increment_seconds         AS "incrementSeconds",
            g.move_count                AS "moveCount",
 
            -- Rating change from rating_history
            rh.rating_before            AS "ratingBefore",
            rh.rating_after             AS "ratingAfter",
            rh.rating_change            AS "ratingChange",
 
            -- Timestamps
            g.started_at                AS "startedAt",
            g.ended_at                  AS "endedAt",
            EXTRACT(EPOCH FROM (g.ended_at - g.started_at))::int AS "durationSeconds"
 
        FROM games g
        LEFT JOIN users u_white ON u_white.id = g.white_player_id
        LEFT JOIN users u_black ON u_black.id = g.black_player_id
        LEFT JOIN rating_history rh ON rh.game_id = g.id AND rh.user_id = $1
 
        WHERE ${whereClause}
        ORDER BY g.ended_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
    `;

    values.push(limit, offset);
    const result = await pool.query<MatchHistoryItem>(query, values);
 
    return { items: result.rows, total };
};

/**
 * Lấy chi tiết một trận (kèm danh sách nước đi)
 */
export const getMatchDetail = async (gameId: string, requestingUserId: string) => {
    const game = await gameRepository.findGameById(gameId);
    if (!game) return null;
 
    // Chỉ cho phép 2 người chơi trong ván xem chi tiết
    if (game.whitePlayerId !== requestingUserId && game.blackPlayerId !== requestingUserId) {
        return null;
    }
 
    const moves = await gameRepository.getGameMoves(gameId);
    return { game, moves };
};

/**
 * Thống kê tổng hợp của player
 */
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

