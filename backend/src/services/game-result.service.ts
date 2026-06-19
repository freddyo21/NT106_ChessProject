import * as gameRepository from "../repositories/game.repository";
import { Logger } from "../utils/Logger";
import type {
    GameOverResult,
    GameOverStatus as GameStatus,
    IChessBoard,
} from "../types/GameResultService";
import type { PieceColor } from "../types/GameResult";

const logger = new Logger("game-result-service");


//------ELO cal-----

const ELO_K_FACTOR = 32;
/**
 * Tính ELO mới theo công thức chuẩn FIDE
 * @param rating        Rating hiện tại của Player
 * @param opponentRating        Rating của đối thủ
 * @param score         1 = thắng, 0.5 = hòa, 0 = thua
 */

export const calculateNewElo = (
    rating: number,
    opponentRating: number,
    score: 0 | 0.5 | 1
): number => {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
    const newRating = Math.round(rating + ELO_K_FACTOR * (score - expectedScore));
    return Math.max(100, newRating); // Sàn tối thiểu 100
};

//-------Game Status Check-----

/**
 * Đọc trạng thái từ ChessBoard và map sang GameStatus
 * Gọi sau mỗi chess_move
 */

export const checkGameOver = (board: IChessBoard): GameStatus => {
    const status = board.getGameStatus();
 
    switch (status) {
        case "checkmate": {
            // Người vừa bị chiếu hết là người thua → currentTurn đang là người thua
            const loserColor = board.getCurrentTurn();
            return {
                over: true,
                result: loserColor === "white" ? "black_win" : "white_win",
                reason: "checkmate",
            };
        }
        case "stalemate":
            return { over: true, result: "draw", reason: "stalemate" };
 
        case "draw":
        case "insufficient_material":
            return { over: true, result: "draw", reason: "insufficient_material" };
 
        case "fifty_move_rule":
            return { over: true, result: "draw", reason: "fifty_move_rule" };
 
        case "threefold_repetition":
            return { over: true, result: "draw", reason: "threefold_repetition" };
 
        default:
            return { over: false };
    }
};

/**
 * Xử lý đầu hàng
 * @param resigningColor    Màu của người đầu hàng
 */
export const handleResignation = (resigningColor: PieceColor): GameStatus => ({
    over: true,
    result: resigningColor === "white" ? "black_win" : "white_win",
    reason: "resign",
});

/**
 * Xử lý hết giờ
 * Theo luật FIDE: nếu người chơi còn giờ không có quân để chiếu hết -> hòa
 */
export const handleTimeout = (
    timedOutColor: PieceColor,
    board: IChessBoard
): GameStatus => {
    if (board.isInsufficientMaterial()) {
        return { over: true, result: "draw", reason: "insufficient_material" };
    }
    return {
        over: true,
        result: timedOutColor === "white" ? "black_win" : "white_win",
        reason: "timeout",
    };
};

/**
 * Xử lý đồng ý hòa
 */
export const handleDrawAgreement = (): GameStatus => ({
    over: true,
    result: "draw",
    reason: "draw_agreement",
});

/**
 * Xử lý ngắt kết nối giữa chừng -> người kia thắng
 */
export const handleDisconnect = (disconnectedColor: PieceColor): GameStatus => ({
    over: true,
    result: disconnectedColor === "white" ? "black_win" : "white_win",
    reason: "aborted",
});


//------Save and Update ELO---

/**
 * Lưu kết quả ván vào DB và cập nhật ELO (chỉ PvP)
 * Trả về GameOverResult kèm rating changes để socket emit về client
 */
export const saveGameResult = async (params: {
    gameId: string;
    gameStatus: GameStatus & { over: true };
    whitePlayerId: string;
    blackPlayerId: string;
    currentFen?: string;
    moveCount?: number;
    whiteTimeLeft?: number;
    blackTimeLeft?: number;
    isRanked?: boolean;
}): Promise<GameOverResult> => {
    const {
        gameId,
        gameStatus,
        whitePlayerId,
        blackPlayerId,
        currentFen,
        moveCount,
        whiteTimeLeft,
        blackTimeLeft,
        isRanked = true,
    } = params;

    const { result, reason } = gameStatus;

    const winnerId =
        result === "white_win" ? whitePlayerId :
        result === "black_win" ? blackPlayerId :
        null;

    // 1. Cập nhật gảng games
    await gameRepository.finishGame({
        gameId,
        result,
        terminationReason: reason,
        winnerId,
        ...(currentFen !== undefined && { currentFen }),
        ...(moveCount !== undefined && { moveCount }),
        ...(whiteTimeLeft !== undefined && { whiteTimeLeft }),
        ...(blackTimeLeft !== undefined && { blackTimeLeft }),
    });

    // 2. Lấy rating hiện tại của cả 2
    const [whiteRatingRow, blackRatingRow] = await Promise.all([
        gameRepository.getRatingOrDefault(whitePlayerId),
        gameRepository.getRatingOrDefault(blackPlayerId),
    ]);
 
    const whiteRatingBefore = whiteRatingRow.rating;
    const blackRatingBefore = blackRatingRow.rating;
 
    let whiteRatingAfter = whiteRatingBefore;
    let blackRatingAfter = blackRatingBefore;

    // 3. Tính ELO mới 
    if (isRanked) {
        const whiteScore: 0 | 0.5 | 1 =
            result === "white_win" ? 1 :
            result === "black_win" ? 0 :
            0.5;
        const blackScore: 0 | 0.5 | 1 =
            result === "black_win" ? 1 :
            result === "white_win" ? 0 :
            0.5;
        
        whiteRatingAfter = calculateNewElo(whiteRatingBefore, blackRatingBefore, whiteScore);
        blackRatingAfter = calculateNewElo(blackRatingBefore, whiteRatingBefore, blackScore);

        // 4. Cập nhật player_ratings
        await Promise.all([
            gameRepository.updateRating({
                userId: whitePlayerId,
                newRating: whiteRatingAfter,
                result: result === "white_win" ? "win" : result === "black_win" ? "loss" : "draw",
            }),
            gameRepository.updateRating({
                userId: blackPlayerId,
                newRating: blackRatingAfter,
                result: result === "black_win" ? "win" : result === "white_win" ? "loss" : "draw",
            }),
        ]);

        // 5. Ghi rating_history
        await Promise.all([
            gameRepository.insertRatingHistory(whitePlayerId, gameId, whiteRatingBefore, whiteRatingAfter),
            gameRepository.insertRatingHistory(blackPlayerId, gameId, blackRatingBefore, blackRatingAfter),
        ]);
 
        logger.log("ELO updated", {
            gameId,
            white: { before: whiteRatingBefore, after: whiteRatingAfter },
            black: { before: blackRatingBefore, after: blackRatingAfter },
        });
    }

    return {
        result,
        reason,
        winnerId,
        whiteRatingBefore,
        blackRatingBefore,
        whiteRatingAfter,
        blackRatingAfter,
        whiteRatingChange: whiteRatingAfter - whiteRatingBefore,
        blackRatingChange: blackRatingAfter - blackRatingBefore,
    };
};
 


