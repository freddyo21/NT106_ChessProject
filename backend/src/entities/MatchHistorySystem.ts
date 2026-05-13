import { Pool } from "pg";
import { GameResultRow } from "./GameResultHandling";

//-------------
// TYPES
//-------------
export interface MatchHistoryRow extends GameResultRow {
    duration_seconds: number | null;
    player_color: "white" | "black";
    player_result: "win" | "loss" | "draw";
}

export interface MatchDetail {
    game: {
        id:                 string;
        result:             string;
        termination_reason: string;
        time_control_type:  string;
        initial_time_seconds: number;
        increment_seconds:  number;
        started_at:         Date | null;
        ended_at:           Date | null;
        duration_seconds:   number | null;
        white_username:     string | null;
        black_username:     string | null;
        winner_username:    string | null;
    };
    moves: {
        move_number:         number;
        turn_side:           string;
        from_pos:            string;
        to_pos:              string;
        piece_type:          string;
        captured_piece_type: string | null;
        promotion_piece:     string | null;
        san_notation:        string;
        is_check:            boolean;
        is_checkmate:        boolean;
        is_castling:         boolean;
        is_promotion:        boolean;
        white_time_left:     number;
        black_time_left:     number;
        time_spent_seconds:  number;
    }[];
}

//-------------
//Match History System
//-------------
export class MatchHistorySystem {
    private readonly db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    //-------Public API-------------
    /**
     * Lấy lịch sử trận đấu của 1 người chơi
     * Kèm: màu quân, kết quả cá nhân, thời gian ván
     */
    public async getMatchHistory(
        userID: string,
        limit:  number = 20,
        offset: number = 0
    ): Promise<MatchHistoryRow[]> {
        const { rows } = await this.db.query(
            `SELECT
                g.id,
                g.status,
                g.result,
                g.termination_reason,
                g.winner_id,
                g.time_control_type,
                g.started_at,
                g.ended_at,
                w.username AS white_username,
                b.username AS black_username,
                u.username AS winner_username,

                -- Thời gian ván đấu
                EXTRACT(EPOCH FROM (g.ended_at - g.started_at))::int AS duration_seconds,

                -- Màu quân của người đang xem
                CASE
                    WHEN g.white_player_id = $1 THEN 'white'
                    ELSE 'black'
                END AS player_color,

                -- Kết quả của người đang xem
                CASE
                    WHEN g.winner_id = $1 THEN 'win'
                    WHEN g.result = 'draw' THEN 'draw'
                    ELSE 'loss'
                END AS player_result

                FROM public.games g
                LEFT JOIN public.users w ON w.id = g.white_player_id
                LEFT JOIN public.users b ON b.id = g.black_player_id
                LEFT JOIN public.users u ON u.id = g.winner_id
                WHERE (g.white_player_id = $1 OR g.black_player_id = $1)
                    AND g.status = 'finished'
                ORDER BY g.ended_at DESC
                LIMIT $2 OFFSET $3`,
                [userID, limit, offset]
        );
        return rows;
    }

    /**
     * Lấy chi tiết 1 ván đấu kèm tất cả nước đi
     * Dùng để xem lại ván
     */
    public async getMatchDetail(gameID: string): Promise<MatchDetail | null> {
        const { rows: [game] } = await this.db.query(
            `SELECT
                g.id,
                g.result,
                g.termination_reason,
                g.time_control_type,
                g.initial_time_seconds,
                g.increment_seconds,
                g.started_at,
                g.ended_at,
                EXTRACT(EPOCH FROM (g.ended_at - g.started_at))::int AS duration_seconds,
                w.username AS white_username,
                b.username AS black_username,
                u.username AS winner_username
             FROM public.games g
             LEFT JOIN public.users w ON w.id = g.white_player_id
             LEFT JOIN public.users b ON b.id = g.black_player_id
             LEFT JOIN public.users u ON u.id = g.winner_id
             WHERE g.id = $1`,
             [gameID]
        );

        if (!game) 
            return null;

        const { rows: moves } = await this.db.query(
            `SELECT
                move_number,
                turn_side,
                from_pos,
                to_pos,
                piece_type,
                captured_piece_type,
                promotion_piece,
                san_notation,
                is_check,
                is_checkmate,
                is_castling,
                is_promotion,
                white_time_left,
                black_time_left,
                time_spent_seconds
             FROM public.game_moves
             WHERE game_id = $1
             ORDER BY move_number ASC`,
             [gameID]
        );

        return { game, moves };
    }

    /**
     * Đếm tổng số ván của 1 người chơi
     * Dùng cho phần trang
     */
    public async countMatchHistory(userID: string): Promise<number> {
        const { rows: [row] } = await this.db.query(
            `SELECT COUNT(*) AS total
             FROM public.games
             WHERE (white_player_id = $1 OR black_player_id = $1)
               AND status = 'finished'`,
            [userID]
        );
        return parseInt(row?.total ?? "0");
    }
}