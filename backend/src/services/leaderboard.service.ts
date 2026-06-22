import * as leaderboardRepository from "../repositories/leaderboard.repository";
import type {
    LeaderboardOptions,
    LeaderboardPage,
    PlayerLeaderboardInfo,
    PlayerProfileStats,
} from "../types/LeaderBoard";

//-----------Service Functions---------
/**
 * Lay bang xep hang co phan trang
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
 * Lay rank + context xung quanh cua 1 nguoi choi
 * Dung cho trang Profile hoac sau khi ket thuc van
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
 * Lay top10 nhanh dung cho widget sidebar
 */
export const getTopTen = async () => {
    const { entries } = await leaderboardRepository.getLeaderboard({
        limit: 10,
        offset: 0,
        minGamesPlayed: 1,
    });
    return entries;
};

export const getPlayerProfileStats = async (userId: string): Promise<PlayerProfileStats> => {
    const stats = await leaderboardRepository.getPlayerProfileStats(userId);

    if (!stats) {
        throw new Error("Player profile stats not found");
    }

    return stats;
};
