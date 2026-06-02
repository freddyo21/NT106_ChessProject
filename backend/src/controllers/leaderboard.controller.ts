import { Request, Response } from "express";
import * as leaderboardService from "../services/leaderboard.service";

export const getLeaderboard = async (req: Request, res: Response) => {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 50), 1), 100);
    const minGamesPlayed = Math.max(Number(req.query.minGamesPlayed ?? 0), 0);

    const data = await leaderboardService.getLeaderboard(page, pageSize, { minGamesPlayed });

    return res.json({ data });
};
