import { Pool } from "pg";

//-----------
//TYPES
//-----------

export interface PlayerProfile {
    //Thông tin cơ bản
    id:           string;
    username:     string;
    avatar_url:   string | null;
    bio:          string | null;
    is_online:    boolean;
    status:       string;
    last_seen_at: Date | null;
    created_at:   Date;

    //Rating ELO
    rating:       number;
    rank:         number | null;

    //Thống kê
    wins:         number;
    losses:       number;
    draws:        number;
    games_played: number;
    win_rate:     number; // %
}

export interface RatingHistoryPoint {
    game_id:       string | null;
    rating_before: number;
    rating_after:  number;
    rating_change: number;
    created_at:    Date;
}

export interface UpdateProfileInput {
    userID:      string;
    avatar_url?: string;
    bio?:        string;
}

export class PlayerProfileSystem {
    private readonly db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    //---------Public API--------
    /**
     * Lấy profile đầy đủ của 1 người chơi
     */
    public async getProfile(userID: string): Promise<PlayerProfile | null> {
        const { rows: [row] } = await this.db.query(
            `SELECT
                u.id,
                u.username,
                u.avatar_url,
                u.bio,
                u.is_online,
                u.status,
                u.last_seen_at,
                u.created_at,
 
                -- Rating ELO
                COALESCE(pr.rating, 1200)       AS rating,
                COALESCE(pr.wins, 0)            AS wins,
                COALESCE(pr.losses, 0)          AS losses,
                COALESCE(pr.draws, 0)           AS draws,
                COALESCE(pr.games_played, 0)    AS games_played,

                -- Win rate
                CASE
                    WHEN COALESCE(pr.games_played, 0) = 0 THEN 0
                    ELSE ROUND((pr.wins::numeric / pr.games_played) * 100, 1)
                END AS win_rate,
 
                -- Rank
                (
                    SELECT COUNT(*) + 1
                    FROM public.player_ratings pr2
                    WHERE pr2.rating > COALESCE(pr.rating, 1200)
                      AND pr2.games_played > 0
                ) AS rank
 
             FROM public.users u
             LEFT JOIN public.player_ratings pr ON pr.user_id = u.id
             WHERE u.id = $1`,
             [userID]
        );
        return row ?? null;
    }

    /**
     * Lấy profile theo username
     * Dùng khi tìm kiếm người chơi
     */
    public async getProfileByUsername(username: string): Promise<PlayerProfile | null> {
        const { rows: [row] } = await this.db.query(
            `SELECT
                u.id,
                u.username,
                u.avatar_url,
                u.bio,
                u.is_online,
                u.status,
                u.last_seen_at,
                u.created_at,
 
                COALESCE(pr.rating, 1200)       AS rating,
                COALESCE(pr.wins, 0)            AS wins,
                COALESCE(pr.losses, 0)          AS losses,
                COALESCE(pr.draws, 0)           AS draws,
                COALESCE(pr.games_played, 0)    AS games_played,
 
                CASE
                    WHEN COALESCE(pr.games_played, 0) = 0 THEN 0
                    ELSE ROUND((pr.wins::numeric / pr.games_played) * 100, 1)
                END AS win_rate,

                (
                    SELECT COUNT(*) + 1
                    FROM public.player_ratings pr2
                    WHERE pr2.rating > COALESCE(pr.rating, 1200)
                      AND pr2.games_played > 0
                ) AS rank
 
             FROM public.users u
             LEFT JOIN public.player_ratings pr ON pr.user_id = u.id
             WHERE u.username = $1`,
             [username]
        );

        return row ?? null;
    }
    /**
     * Cập nhật avatar và bio
     */
    public async updateProfile(input: UpdateProfileInput): Promise<void> {
        const { userID, avatar_url, bio } = input;

        await this.db.query(
            `UPDATE public.users
             SET avatar_url = COALESCE($1, avatar_url),
                 bio        = COALESCE($2, bio),
                 updated_at = now()
             WHERE id = $3`,
             [avatar_url ?? null, bio ?? null, userID]
        );
    }

    /**
     * Lấy lịch sử rating để vẽ biểu đồ
     * Mặc định lấy 30 ván gần nhất
     */
    public async getRatingHistory(
        userID: string,
        limit:  number = 30
    ): Promise<RatingHistoryPoint[]> {
        const { rows } = await this.db.query(
            `SELECT
                game_id,
                rating_before,
                rating_after,
                rating_change,
                created_at
             FROM public.rating_history
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [userID, limit]
        );
 
        // Đảo lại để biểu đồ hiển thị từ cũ → mới
        return rows.reverse();
    }

    /**
     * Lấy danh sách người chơi đang online
     * Dùng cho tính năng "Danh sách online"
     */
    public async getOnlinePlayers(): Promise<{
        id:       string;
        username: string;
        avatar_url: string | null;
        status:   string;
        rating:   number;
    }[]> {
        const { rows } = await this.db.query(
            `SELECT
                u.id,
                u.username,
                u.avatar_url,
                u.status,
                COALESCE(pr.rating, 1200) AS rating
             FROM public.users u
             LEFT JOIN public.player_ratings pr ON pr.user_id = u.id
             WHERE u.is_online = true
             ORDER BY COALESCE(pr.rating, 1200) DESC`
        );
        return rows;
    }
}