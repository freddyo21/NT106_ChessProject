import * as gameRepository from "../repositories/game.repository";
import * as matchHistoryRepository from "../repositories/match-history.repository";
import type {
    MatchHistoryItem,
    MatchHistoryOptions,
} from "../types/MatchHistory";

//------Servicfe Functions------

/**
 * Láº¥y lá»‹ch sá»­ tráº­n Ä‘áº¥u cá»§a má»™t ngÆ°á»i chÆ¡i
 */
export const getMatchHistory = async (
    userId: string,
    options: MatchHistoryOptions = {}
): Promise<{ items: MatchHistoryItem[]; total: number }> => {
    return matchHistoryRepository.findMatchHistoryByUserId(userId, options);
};

/**
 * Láº¥y chi tiáº¿t má»™t tráº­n (kÃ¨m danh sÃ¡ch nÆ°á»›c Ä‘i)
 */
export const getMatchDetail = async (gameId: string, requestingUserId: string) => {
    const game = await gameRepository.findGameById(gameId);
    if (!game) return null;

    // Chá»‰ cho phÃ©p 2 ngÆ°á»i chÆ¡i trong vÃ¡n xem chi tiáº¿t
    if (game.whitePlayerId !== requestingUserId && game.blackPlayerId !== requestingUserId) {
        return null;
    }

    const moves = await gameRepository.getGameMoves(gameId);
    return { game, moves };
};

/**
 * Thá»‘ng kÃª tá»•ng há»£p cá»§a player
 */
export const getPlayerStats = async (userId: string) => {
    return matchHistoryRepository.getPlayerStats(userId);
};
