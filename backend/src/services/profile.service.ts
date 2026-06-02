import * as gameRepository from "../repositories/game.repository";
import * as profileRepository from "../repositories/profile.repository";
import { getPlayerStats } from "./match-history.service";
import { Exception } from "../exceptions";
import type {
    PlayerProfile,
    UpdateProfileData,
} from "../types/Profile";

//--------Service Functions--------

/**
 * Láº¥y profile Ä‘áº§y Ä‘á»§ cá»§a 1 ngÆ°á»i chÆ¡i (public)
 */
export const getProfile = async (userId: string): Promise<PlayerProfile | null> => {
    return profileRepository.findProfileById(userId);
};

/**
 * Láº¥y profile theo username
 */
export const getProfileByUsername = async (username: string): Promise<PlayerProfile | null> => {
    return profileRepository.findProfileByUsername(username);
};

/**
 * Cáº­p nháº­t thÃ´ng tin profile (chá»‰ cho phÃ©p username, avatar, bio)
 */
export const updateProfile = async (
    userId: string,
    data: UpdateProfileData
): Promise<PlayerProfile> => {
    const hasChanges = data.username !== undefined || data.avatarUrl !== undefined || data.bio !== undefined;

    if (!hasChanges) {
        throw new Exception("No fields to update", 400);
    }

    if (data.username !== undefined) {
        const isTaken = await profileRepository.isUsernameTakenByAnotherUser(data.username, userId);
        if (isTaken) {
            throw new Exception("Username already taken", 409);
        }
    }

    await profileRepository.updateProfileFields(userId, data);

    const updated = await getProfile(userId);
    if (!updated) throw new Exception("User not found", 404);
    return updated;
};

/**
 * Láº¥y biá»ƒu Ä‘á»“ rating theo thá»i gian (DÃ¹ng cho Profile chart)
 */
export const getRatingChart = async (userId: string, limit = 30) => {
    return gameRepository.getRatingHistory(userId, limit);
};

/**
 * Láº¥y profile Ä‘áº§y Ä‘á»§ kÃ¨m stats (dÃ¹ng cho profile chÃ­nh)
 */
export const getFullProfile = async (userId: string) => {
    const [profile, stats] = await Promise.all([
        getProfile(userId),
        getPlayerStats(userId),
    ]);

    if (!profile) return null;

    return { ...profile, stats };
};

/**
 * Cáº­p nháº­t tráº¡ng thÃ¡i online cá»§a ngÆ°á»i chÆ¡i
 */
export const setOnlineStatus = async (
    userId: string,
    isOnline: boolean
): Promise<void> => {
    await profileRepository.updateOnlineStatus(userId, isOnline);
};

/**
 * Cáº­p nháº­t status in_game khi báº¯t Ä‘áº§u / káº¿t thÃºc vÃ¡n
 */
export const setInGameStatus = async (
    userId: string,
    inGame: boolean
): Promise<void> => {
    await profileRepository.updateInGameStatus(userId, inGame);
};

/**
 * Láº¥y danh sÃ¡ch ngÆ°á»i chÆ¡i Ä‘ang onl
 */
export const getOnlinePlayers = async (limit = 50) => {
    return profileRepository.findOnlinePlayers(limit);
};
