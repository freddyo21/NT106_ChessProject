import { Logger } from "../utils/Logger";
import { Exception } from "../exceptions";
import * as gameRepository from "../repositories/game.repository";
import * as matchmakingRepository from "../repositories/matchmaking.repository";
import type {
    MatchmakingMode,
    MatchmakingResult,
} from "../types/MatchMaking";
import type { TimeControlType } from "../types/TimeControl";

const logger = new Logger("matchmaking-service");


//-------Time control presets-----------
const TIME_CONTROL_PRESETS: Record<TimeControlType, { initialTimeSeconds: number; incrementSeconds: number }> = {
    bullet:    { initialTimeSeconds: 60,   incrementSeconds: 0 },
    blitz:     { initialTimeSeconds: 300,  incrementSeconds: 0 },
    rapid:     { initialTimeSeconds: 600,  incrementSeconds: 0 },
    classical: { initialTimeSeconds: 1800, incrementSeconds: 0 },
};


//---------Room code generator----------
const generateRoomCode = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bá» I, O, 0, 1 cho dá»… Ä‘á»c
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const generateUniqueRoomCode = async (): Promise<string> => {
    let roomCode = generateRoomCode();
    let attempts = 0;

    while (attempts < 5) {
        const exists = await matchmakingRepository.isRoomCodeTaken(roomCode);
        if (!exists) return roomCode;

        roomCode = generateRoomCode();
        attempts++;
    }

    throw new Exception("Could not generate a unique room code", 500);
};

//---------Queue management-----------
/**
 * Add a player to the matchmaking queue.
 */
export const joinQueue = async (
    userId: string,
    mode: MatchmakingMode,
    timeControlType: TimeControlType,
    currentRating: number
): Promise<void> => {
    await matchmakingRepository.upsertQueueEntry(userId, mode, timeControlType, currentRating);

    logger.log("Player joined queue", { userId, mode, timeControlType, rating: currentRating });
};

/**
 * Remove a player from the matchmaking queue.
 */
export const leaveQueue = async (userId: string): Promise<void> => {
    await matchmakingRepository.deleteQueueEntry(userId);
    logger.log("Player left queue", { userId });
};

/**
 * Check whether the player is currently queued.
 */
export const isInQueue = async (userId: string): Promise<boolean> => {
    return matchmakingRepository.hasQueueEntry(userId);
};

//-------Matchmaking logic---------
/**
 * Find a compatible opponent and create a game record.
 */
export const findMatch = async (userId: string): Promise<MatchmakingResult> => {
    const me = await matchmakingRepository.findQueueEntry(userId);

    if (!me) return { matched: false };

    const opponent = await matchmakingRepository.findOpponent(userId, me.mode, me.timeControlType);

    if (!opponent) return { matched: false };

    // Randomize colors.
    const whitePlayerId = Math.random() < 0.5 ? userId : opponent.userId;
    const blackPlayerId = whitePlayerId === userId ? opponent.userId : userId;
    const roomCode = await generateUniqueRoomCode();
    const preset = TIME_CONTROL_PRESETS[me.timeControlType as TimeControlType];

    // 5. Táº¡o game record
    const game = await gameRepository.createGame({
        whitePlayerId,
        blackPlayerId,
        createdBy: userId,
        roomCode,
        timeControlType: me.timeControlType,
        initialTimeSeconds: preset.initialTimeSeconds,
        incrementSeconds: preset.incrementSeconds,
        whiteRatingSnapshot: whitePlayerId === userId ? me.ratingAtQueue : opponent.ratingAtQueue,
        blackRatingSnapshot: blackPlayerId === userId ? me.ratingAtQueue : opponent.ratingAtQueue,
    });

    // 6. XÃ³a cáº£ 2 khá»i queue
    await matchmakingRepository.deleteQueueEntries([userId, opponent.userId]);

    logger.log("Match found", {
        gameId: game.id,
        roomCode,
        white: whitePlayerId,
        black: blackPlayerId,
        timeControl: me.timeControlType,
    });

    return {
        matched: true,
        gameId: game.id,
        roomCode,
        whitePlayerId,
        blackPlayerId,
        timeControlType: me.timeControlType,
        initialTimeSeconds: preset.initialTimeSeconds,
        incrementSeconds: preset.incrementSeconds,
    };
};

/**
 * Láº¥y sá»‘ ngÆ°á»i Ä‘ang trong queue (theo tá»«ng time control)
 * DÃ¹ng Ä‘á»ƒ hiá»ƒn thá»‹ "X players waiting"
 */
export const getQueueStats = async () => {
    return matchmakingRepository.getQueueStats();
};
