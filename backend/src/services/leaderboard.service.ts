import * as leaderboardRepository from "../repositories/leaderboard.repository";
import { LeaderboardOptions } from "../repositories/leaderboard.repository";

//-----------Types------------

export interface LeaderboardPage {
    entries: leaderboardRepository.LeaderboardEntry[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
 
export interface PlayerLeaderboardInfo {
    rank: number | null;
    nearbyPlayers: leaderboardRepository.LeaderboardEntry[];
}

//-----------Service Functions---------
/**
 * Lấy bảng xếp hạng có phân trang
 */
export const getLeaderboard = async (
    page = 1,
    pageSize = 50,
    options: Omit<LeaderboardOptions, "limit" | "offset"> = {}
): Promise<LeaderboardPage> => {
    const offset = (page - 1) * pageSize;
 
    const { entries, total } = await leaderboardRepository.getLeaderboard({
        ...options,
        limit: pageSize,
        offset,
    });
 
    return {
        entries,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
};

/**
 * Lấy rank + context xung quanh của 1 người chơi
 * Dùng cho trang Profile hoặc sau khi kết thúc ván
 */
export const getPlayerLeaderboardInfo = async (
    userId: string
): Promise<PlayerLeaderboardInfo> => {
    const [rank, nearbyPlayers] = await Promise.all([
        leaderboardRepository.getPlayerRank(userId),
        leaderboardRepository.getNearbyPlayers(userId, 5),
    ]);
 
    return { rank, nearbyPlayers };
};

/**
 * Lấy top10 nhanh (dùng cho widget sidebar)
 */
export const getTopTen = async () => {
    const { entries } = await leaderboardRepository.getLeaderboard({
        limit: 10,
        offset: 0,
        minGamesPlayed: 1,
    });
    return entries;
};