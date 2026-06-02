import { Request, Response } from "express";
import * as matchHistoryService from "../services/match-history.service";

type AuthenticatedRequest = Request & {
    user?: {
        id?: string;
    };
};

export const getMyMatchHistory = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: "Missing authenticated user" });
    }

    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 20), 1), 100);
    const offset = (page - 1) * pageSize;
    const timeControlType = typeof req.query.timeControlType === "string"
        ? req.query.timeControlType
        : undefined;

    const data = await matchHistoryService.getMatchHistory(userId, {
        limit: pageSize,
        offset,
        ...(timeControlType ? { timeControlType } : {}),
    });

    return res.json({
        data: {
            ...data,
            page,
            pageSize,
            totalPages: Math.ceil(data.total / pageSize),
        },
    });
};
