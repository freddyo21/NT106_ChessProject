import { Pool } from "pg";
import { GameEndResult, GameEndReason } from "./EndGameLogic";
import { Color } from "../types/Color";

//-------------
//TYPES
//------------
export interface GameResultInput {
    gameID: string;
    whitePlayerID: string;
    blackPlayerID: string;
    result: GameEndResult;
}

export interface GameResultRow {
    id: string;
    status: string;
    result: string;
    termination_reason: string;
    winner_id: string | null;
    time_control_type: string;
    started_at: Date | null;
    ended_at: Date | null;
    white_username: string | null;
    black_username: string | null;
    winner_username: string | null;
}

//------------
//CONSTTANTS
const TERMINATION_MAP: Record<GameEndReason, string> = {
    checkmate: "checkmate",
    stalemate: "stalemate",
    insufficient_material: "insufficient_material",
    resignation: "resign",
    timeout: "timeout",
};

function toDbResult(winner: Color | null): "white_win" | "black_win" | "draw" {
    if (winner === "white")
        return "white_win";
        if (winner === "black")
        return "black_win";
    return "draw";
}

//-------------
//GameResultHandling
//----------------
export class GameResultHandling {
    private readonly db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    //---------Public API-----------
    /**
     * Lưu kết quả ván cờ vào database
     */
    public async saveGameResult(input: GameResultInput): Promise<void> {
        const { gameID, whitePlayerID, blackPlayerID, result } = input;

        if (!result.ended)
            return;

        const dbResult = toDbResult(result.winner);
        const terminationReason = TERMINATION_MAP[result.reason];
        const winnerID =
            result.winner === "white" ? whitePlayerID :
            result.winner === "black" ? blackPlayerID :
            null;

        await this.db.query(
            `UPDATE public.games
            SET status  = 'finished',
                result  = $1,
                termination_reason = $2,
                winner_id = $3,
                ended_at = now(),
                updated_at = now()
            WHERE id = $4`,
            [dbResult, terminationReason, winnerID, gameID]
        );
    }

    /**
     * Đánh dấu game bị hủy
     * VD: người chơi disconnect trước khi bắt đầu
     */
    public async abortGame(gameID: string): Promise<void> {
        await this.db.query(
            `UPDATE public.games
            SET status = 'aborted',
                termination_reason = 'aborted',
                ended_at = now(),
                updated_at = now()
            WHERE id = $1`,
            [gameID] 
        );
    }

    /**
     * Lấy kết quả 1 ván có kèm thông tin người chơi
     */
    public async getGameResult(gameID: string): Promise<GameResultRow | null> {
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
                u.username AS winner_username
            FROM public.games g
            LEFT JOIN public.users w ON w.id = g.white_player_id
            LEFT JOIN public.users b ON b.id = g.black_player_id
            LEFT JOIN public.users u ON u.id = g.winner_id
            WHERE g.id = $1`,
            [gameID]
        );
        return rows[0] ?? null;
    }

    /**
     * Lấy danh sách ván đã kết thúc của 1 người chơi
     */
    public async getPlayerGameHistory(
        userID: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<GameResultRow[]> {
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
                u.username AS winner_username
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
}

