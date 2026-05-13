import { Pool } from "pg";

//--------
//TYPES
//---------
export interface LeaderBoardRow {
    rank: number;
    user_id: string;
    username: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    games_played: number;
    win_rate: number; // %
}

export interface EloUpdateInput {
    gameID: string;
    whitePlayerID: string;
    blackPlayerID: string;
    outcome: "white_win" | "black_win" | "draw";
}

//-----------
//ELO helpers
//----------
function getKFactor(rating: number, gamesPlayed: number): number {
    if (gamesPlayed < 30)
        return 40;  // newbie
    if (rating >= 2400)
        return 10;  //pro
    return 20;  //nor
}

function expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calcNewRating(
    rating: number,
    expected: number,
    actual: number,
    k: number
): number {
    return Math.round(rating + k * (actual - expected));
}

//------------
//LeaderBoardSystem
//--------------
export class LeaderBoardSystem {
    private readonly db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    //---------Publoc API-----------
    /**
     * Lap top 10
     */
    public async getTopLeaderBoard(): Promise<LeaderBoardRow[]> {
        const { rows } = await this.db.query(
            `SELECT
                ROW_NUMBER() OVER (ORDER BY pr.rating DESC) AS rank,
                u.id    AS user_id,
                u.username,
                pr.rating,
                pr.wins,
                pr.losses,
                pr.draws,
                pr.games_played,
                CASE
                    WHEN pr.games_played = 0 THEN 0
                    ELSE ROUND((pr.wins::numeric / pr.games_played) * 100, 1)
                END AS win_rate
                FROM public.player_ratings pr
                JOIN public.users u ON u.id = pr.user_id
                WHERE pr.games_played > 0
                ORDER BY pr.rating DESC
                LIMIT 10`
        );
        return rows;
    }
    
    /**
     * Lay rank cua 1 nguoi choi
     */
    public async getPLayerRank(userID: string): Promise<number | null> {
        const { rows } = await this.db.query (
            `SELECT rank FROM (
                SELECT
                    user_id,
                    ROW_NUMBER() OVER (ORDER BY rating DESC) AS rank
                FROM public.player_ratings
                WHERE games_played > 0
            ) ranked
            WHERE user_id = $1`,
            [userID]
        );
        return rows[0]?.rank ?? null;
    }

    /**
     * Tinh ELO moi va cap nhat sau moi van
     */
    public async updateElo(input: EloUpdateInput): Promise<void> {
        const { gameID, whitePlayerID, blackPlayerID, outcome } = input;

        const client = await this.db.connect();
        try {
            await client.query("BEGIN");

            //Lay rating hien tai
            const fetchPlayer = async (userID: string) => {
                const { rows } = await client.query(
                    `SELECT rating, wins, losses, draws, games_played
                    FROM public.player_ratings
                    WHERE user_id = $1`,
                    [userID]
                );
                return rows[0] ?? { rating: 1200,
                                    wins: 0, 
                                    losses: 0, 
                                    draws: 0, 
                                    games_played: 0  
                                };
            };

            const white = await fetchPlayer(whitePlayerID);
            const black = await fetchPlayer(blackPlayerID);

            //Score thuc te
            const whiteActual = outcome === "white_win" ? 1 : outcome === "draw" ? 0.5 : 0;
            const blackActual = 1 - whiteActual;

            //Expected Score
            const whiteExpected = expectedScore(white.rating, black.rating);
            const blackExpected = expectedScore(black.rating, white.rating);
    
            //Rating moi
            const whiteNew = calcNewRating(white.rating, whiteExpected, whiteActual, getKFactor(white.rating, white.games_played));
            const blackNew = calcNewRating(black.rating, blackExpected, blackActual, getKFactor(black.rating, black.games_played));

            //W/L/D delta
            const whiteWin = outcome === "white_win" ? 1 : 0;
            const whiteLoss = outcome === "black_win" ? 1 : 0;
            const whiteDraw = outcome === "draw" ? 1 : 0;
            const blackWin = outcome === "black_win" ? 1 : 0;
            const blackLoss = outcome === "white_win" ? 1 : 0;
            const blackDraw = outcome === "draw" ? 1 : 0;

            //Upser player_ratings
            const upsert = `
                INSERT INTO public.player_ratings
                    (user_id, rating, wins, losses, draws, games_played, last_rated_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, 1, now(), now())
                ON CONFlict (user_id) DO UPDATE
                SET rating  = $2,
                    wins    = player_ratings.wins + $3,
                    losses  = player_ratings.losses + $4,
                    draws   = player_ratings.draws + $5,
                    games_played = player_ratings.games_played + 1,
                    last_rated_at = now(),
                    updated_at = now()        
                `;

                await client.query(upsert, [whitePlayerID, whiteNew,whiteWin, whiteLoss, whiteDraw]);
                await client.query(upsert, [blackPlayerID, blackNew, blackWin, blackLoss, blackDraw]);

                //Ghi rating_history
                const history = `
                    INSERT INTO public.rating_history
                        (user_id, game_id, rating_before, rating_after, rating_change)
                    VALUES ($1, $2, $3, $4, $5)`;

        await client.query(history, [whitePlayerID, gameID, white.rating, whiteNew, whiteNew - white.rating]);
        await client.query(history, [blackPlayerID, gameID, black.rating, blackNew, blackNew - black.rating]);

        await client.query("COMMIT");
       } catch (err) {
        await client.query("ROLLBACK");
        throw err;
       } finally {
        client.release();
       }
    }
}