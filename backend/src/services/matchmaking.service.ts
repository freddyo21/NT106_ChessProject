import { pool } from "../config/db";
import { Logger } from "../utils/Logger";
import { Exception } from "../exceptions";
import * as gameRepository from "../repositories/game.repository";

const logger = new Logger("matchmaking-service");

//--------------Types-------------------
export type MatchmakingMode = "casual" | "ranked";
export type TimeControlType = "bullet" | "blitz" | "rapid" | "classical";
 
export interface QueueEntry {
    userId: string;
    mode: MatchmakingMode;
    timeControlType: TimeControlType;
    ratingAtQueue: number;
    createdAt: Date;
}
 
export interface MatchFound {
    matched: true;
    gameId: string;
    roomCode: string;
    whitePlayerId: string;
    blackPlayerId: string;
    timeControlType: TimeControlType;
    initialTimeSeconds: number;
    incrementSeconds: number;
}
 
export interface MatchNotFound {
    matched: false;
}
 
export type MatchmakingResult = MatchFound | MatchNotFound;

//-------Time control presets-----------
const TIME_CONTROL_PRESETS: Record<TimeControlType, { initialTimeSeconds: number; incrementSeconds: number }> = {
    bullet:    { initialTimeSeconds: 60,   incrementSeconds: 0 },
    blitz:     { initialTimeSeconds: 300,  incrementSeconds: 0 },
    rapid:     { initialTimeSeconds: 600,  incrementSeconds: 0 },
    classical: { initialTimeSeconds: 1800, incrementSeconds: 0 },
};


//---------Room code generator----------
const generateRoomCode = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ I, O, 0, 1 cho dễ đọc
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

//---------Queue management-----------
/**
 * Thêm người chơi vào hàng chờ matchmaking
 */
export const joinQueue = async (
    userId: string,
    mode: MatchmakingMode,
    timeControlType: TimeControlType,
    currentRating: number
): Promise<void> => {
    await pool.query(
        `
        INSERT INTO matchmaking_queue (user_id, mode, time_control_type, rating_at_queue)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
            mode                = EXCLUDED.mode,
            time_control_type   = EXCLUDED.time_control_type,
            rating_at_queue     = EXCLUDED.rating_at_queue,
            created_at          = now()
        `,
        [userId, mode, timeControlType, currentRating]
    );
 
    logger.log("Player joined queue", { userId, mode, timeControlType, rating: currentRating });
};

/**
 * Xóa người chơi khỏi hàng chờ
 */
export const leaveQueue = async (userId: string): Promise<void> => {
    await pool.query(
        `DELETE FROM matchmaking_queue WHERE user_id = $1`,
        [userId]
    );
    logger.log("Player left queue", { userId });
};

/**
 * Kiểm tra người chơi có đang trong queue không
 */
export const isInQueue = async (userId: string): Promise<boolean> => {
    const result = await pool.query(
        `SELECT 1 FROM matchmaking_queue WHERE user_id = $1`,
        [userId]
    );
    return result.rows.length > 0;
};

//-------Matchmaking logic---------
/**
 * Tìm đối thủ phù hợp cho người chơi trong queue
 * Gọi định kỳ từ socket (vd mỗi 2s) hoặc trigger khi có người mới join
 * 
 * Thuật toán: (simplified cho đồ án - ít player)
 * 1. Lấy entry của userId từ queue
 * 2. Tìm bất kỳ người nào đang chờ, cùng mode + time control là đủ (không filter rating)
 * 3. Nếu tìm được -> tạo game, xóa cả 2 khỏi queue
 */
export const findMatch = async (userId: string): Promise<MatchmakingResult> => {
    // 1. Lấy entry của người này
    const myEntry = await pool.query<QueueEntry>(
            `
            SELECT
                user_id           AS "userId",
                mode,
                time_control_type AS "timeControlType",
                rating_at_queue   AS "ratingAtQueue",
                created_at        AS "createdAt"
            FROM matchmaking_queue
            WHERE user_id = $1
            `,
            [userId]
        );
    
        if (myEntry.rows.length === 0) return { matched: false };
    
        const me = myEntry.rows[0]!;
    

    // 2. Tìm bất kỳ người nào đang chờ, cùng mode + time control
    // Không filter rating — phù hợp khi ít player (đồ án / demo)
    // ORDER BY created_at ASC → ưu tiên người chờ lâu nhất
    const opponentResult = await pool.query<QueueEntry>(
        `
        SELECT
            user_id             AS "userId",
            mode,
            time_control_type   AS "timeControlType",
            rating_at_queue     AS "ratingAtQueue",
            created_at          AS "createdAt"
        FROM matchmaking_queue
        WHERE user_id != $1
            AND mode = $2
            AND time_control_type = $3
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        `,
        [userId, me.mode, me.timeControlType]
    );
    
    if (opponentResult.rows.length === 0) return { matched: false };
    
    const opponent = opponentResult.rows[0]!;

    // 3. Random màu quân
    const whitePlayerId = Math.random() < 0.5 ? userId : opponent.userId;
    const blackPlayerId = whitePlayerId === userId ? opponent.userId : userId;
    // 4. Tạo room code unique
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (attempts < 5) {
        const existing = await pool.query(
            `SELECT 1 FROM games WHERE room_code = $1`,
            [roomCode]
        );
        if (existing.rows.length === 0) break;
        roomCode = generateRoomCode();
        attempts++;
    }
    
    const preset = TIME_CONTROL_PRESETS[me.timeControlType as TimeControlType];
    
    // 5. Tạo game record
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
    // 6. Xóa cả 2 khỏi queue
    await pool.query(
        `DELETE FROM matchmaking_queue WHERE user_id IN ($1, $2)`,
        [userId, opponent.userId]
    );
 
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
 * Lấy số người đang trong queue (theo từng time control)
 * Dùng để hiển thị "X players waiting"
 */
export const getQueueStats = async () => {
    const result = await pool.query(
        `
        SELECT
            time_control_type   AS "timeControlType",
            mode,
            COUNT(*)            AS count
        FROM matchmaking_queue
        GROUP BY time_control_type, mode
        ORDER BY time_control_type, mode
        `
    );
    return result.rows;
};