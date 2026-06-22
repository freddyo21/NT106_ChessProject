import { Request, Response } from "express";
import * as leaderboardService from "../services/leaderboard.service";

type AuthenticatedRequest = Request & {
    user?: {
        id?: string;
    };
};

export const getLeaderboard = async (req: Request, res: Response) => {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 50), 1), 100);
    const minGamesPlayed = Math.max(Number(req.query.minGamesPlayed ?? 0), 0);

    const data = await leaderboardService.getLeaderboard(page, pageSize, { minGamesPlayed });

    return res.json({ data });
};

export const getMyProfileStats = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: "Missing authenticated user" });
    }

    const data = await leaderboardService.getPlayerProfileStats(userId);
    return res.json({ data });
};
