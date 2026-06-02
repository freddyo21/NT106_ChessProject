import { pool } from "../config/database.config";
import type {
    CreateGameData,
    FinishGameData,
    GameRow,
    PlayerRatingRow,
    RecordMoveData,
    UpdateRatingData,
} from "../types/GameRepository";
    //---------Column alias helper--------------

    const GAME_SELECT_COLUMNS = `
        id,
        white_player_id         AS "whitePlayerId",
        black_player_id         AS "blackPlayerId",
        created_by              AS "createdBy",
        winner_id               AS "winnerId",
        white_rating_snapshot   AS "whiteRatingSnapshot",
        black_rating_snapshot   AS "blackRatingSnapshot",
        room_code               AS "roomCode",
        is_private              AS "isPrivate",
        game_mode               AS "gameMode",
        ai_level                AS "aiLevel",
        status,
        result,
        termination_reason      AS "terminationReason",
        current_fen             AS "currentFen",
        current_turn            AS "currentTurn",
        move_count              AS "moveCount",
        halfmove_clock          AS "halfmoveClock",
        time_control_type       AS "timeControlType",
        initial_time_seconds    AS "initialTimeSeconds",
        increment_seconds       AS "incrementSeconds",
        white_time_left         AS "whiteTimeLeft",
        black_time_left         AS "blackTimeLeft",
        started_at              AS "startedAt",
        ended_at                AS "endedAt",
        last_move_at            AS "lastMoveAt",
        created_at              AS "createdAt",
        updated_at              AS "updatedAt"
    `;

    const RATING_SELECT_COLUMNS = `
        user_id         AS "userId",
        rating,
        wins,
        losses,
        draws,
        games_played    AS "gamesPlayed",
        last_rated_at   AS "lastRatedAt",
        updated_at      AS "updatedAt"
    `;

    //------Games------

    export const createGame = async (data: CreateGameData): Promise<GameRow> => {
        const {
            whitePlayerId,
            blackPlayerId,
            createdBy,
            roomCode,
            isPrivate = false,
            gameMode = "pvp",
            aiLevel,
            timeControlType,
            initialTimeSeconds,
            incrementSeconds,
            whiteRatingSnapshot,
            blackRatingSnapshot,
        } = data;

        const result = await pool.query<GameRow>(
            `
            INSERT INTO games (
                white_player_id, black_player_id, created_by, room_code,
                is_private, game_mode, ai_level,
                time_control_type, initial_time_seconds, increment_seconds,
                white_time_left, black_time_left,
                white_rating_snapshot, black_rating_snapshot,
                status, started_at
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9, $10,
                $11, $12,
                $13, $14,
                'ongoing', now()
            )
            RETURNING ${GAME_SELECT_COLUMNS}
            `,
            [
            whitePlayerId, blackPlayerId, createdBy, roomCode,
            isPrivate, gameMode, aiLevel ?? null,
            timeControlType, initialTimeSeconds, incrementSeconds,
            initialTimeSeconds, initialTimeSeconds,
            whiteRatingSnapshot ?? null, blackRatingSnapshot ?? null,
            ]
        );

        if (!result.rows[0]) throw new Error("Failed to create game");
        return result.rows[0];
    };

    export const findGameById = async (gameId: string): Promise<GameRow | null> => {
        const result = await pool.query<GameRow>(
            `SELECT ${GAME_SELECT_COLUMNS} FROM games WHERE id = $1`,
            [gameId]
        );
        return result.rows[0] ?? null;
    };

    export const findGameByRoomCode = async (roomCode: string): Promise<GameRow | null> => {
        const result = await pool.query<GameRow>(
            `SELECT ${GAME_SELECT_COLUMNS} FROM games WHERE room_code = $1`,
            [roomCode]
        );
        return result.rows[0] ?? null;
    };

    export const finishGame = async (data: FinishGameData): Promise<GameRow | null> => {
        const {
            gameId,
            result,
            terminationReason,
            winnerId,
            currentFen,
            moveCount,
            whiteTimeLeft,
            blackTimeLeft,
        } = data;

        const queryResult = await pool.query<GameRow>(
            `
            UPDATE games SET
                status              = 'finished',
                result              = $2,
                termination_reason  = $3,
                winner_id           = $4,
                ended_at            = now(),
                updated_at          = now(),
                current_fen         = COALESCE($5, current_fen),
                move_count          = COALESCE($6, move_count),
                white_time_left     = COALESCE($7, white_time_left),
                black_time_left     = COALESCE($8, black_time_left)
            WHERE id = $1
            RETURNING ${GAME_SELECT_COLUMNS}
            `,
            [gameId, result, terminationReason, winnerId,
            currentFen ?? null, moveCount ?? null,
            whiteTimeLeft ?? null, blackTimeLeft ?? null]
        );

        return queryResult.rows[0] ?? null;
    };

    export const abortGame = async (gameId: string): Promise<GameRow | null> => {
        const result = await pool.query<GameRow>(
            `
            UPDATE games SET
                status      = 'aborted',
                termination_reason = 'aborted',
                ended_at    = now(),
                updated_at  = now()
            WHERE id = $1
            RETURNING ${GAME_SELECT_COLUMNS}
            `,
            [gameId]
        );
        return result.rows[0] ?? null;
    };

    export const updateTimeLeft = async (
        gameId: string,
        whiteTimeLeft: number,
        blackTimeLeft: number
    ): Promise<void> => {
        await pool.query(
            `
            UPDATE games SET
                white_time_left = $2,
                black_time_left = $3,
                last_move_at    = now(),
                updated_at      = now()
            WHERE id = $1
            `,
            [gameId, whiteTimeLeft, blackTimeLeft]
        );
    };

    export const updateCurrentFen = async (
        gameId: string,
        fen: string,
        currentTurn: "white" | "black",
        moveCount: number,
        halfmoveClock: number
    ): Promise<void> => {
        await pool.query(
            `
            UPDATE games SET
                current_fen     = $2,
                current_turn    = $3,
                move_count      = $4,
                halfmove_clock  = $5,
                last_move_at    = now(),
                updated_at      = now()
            WHERE id = $1
            `,
            [gameId, fen, currentTurn, moveCount, halfmoveClock]
        );
    };

    //-------Game Moves-----
    export const recordMove = async (data: RecordMoveData): Promise<void> => {
        const {
            gameId, playerId, playerUsername, moveNumber, turnSide,
            fromPos, toPos, pieceType, capturedPieceType, promotionPiece,
            sanNotation, uciNotation, fenBefore, fenAfter,
            isCheck = false, isCheckmate = false, isCastling = false, isPromotion = false,
            whiteTimeLeft, blackTimeLeft, timeSpentSeconds,
        } = data;

        await pool.query(
        `
            INSERT INTO game_moves (
                game_id, player_id, player_username, move_number, turn_side,
                from_pos, to_pos, piece_type, captured_piece_type, promotion_piece,
                san_notation, uci_notation, fen_before, fen_after,
                is_check, is_checkmate, is_castling, is_promotion,
                white_time_left, black_time_left, time_spent_seconds
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14,
                $15, $16, $17, $18,
                $19, $20, $21
            )
            `,
            [
                gameId, playerId, playerUsername, moveNumber, turnSide,
                fromPos, toPos, pieceType, capturedPieceType ?? null, promotionPiece ?? null,
                sanNotation, uciNotation ?? null, fenBefore, fenAfter,
                isCheck, isCheckmate, isCastling, isPromotion,
                whiteTimeLeft, blackTimeLeft, timeSpentSeconds,
            ]
        );
    };

    export const getGameMoves = async (gameId: string) => {
        const result = await pool.query(
            `
            SELECT
                id,
                game_id             AS "gameId",
                player_id           AS "playerId",
                player_username     AS "playerUsername",
                move_number         AS "moveNumber",
                turn_side           AS "turnSide",
                from_pos            AS "fromPos",
                to_pos              AS "toPos",
                piece_type          AS "pieceType",
                captured_piece_type AS "capturedPieceType",
                promotion_piece     AS "promotionPiece",
                san_notation        AS "sanNotation",
                uci_notation        AS "uciNotation",
                fen_before          AS "fenBefore",
                fen_after           AS "fenAfter",
                is_check            AS "isCheck",
                is_checkmate        AS "isCheckmate",
                is_castling         AS "isCastling",
                is_promotion        AS "isPromotion",
                white_time_left     AS "whiteTimeLeft",
                black_time_left     AS "blackTimeLeft",
                time_spent_seconds  AS "timeSpentSeconds",
                created_at          AS "createdAt"
            FROM game_moves
            WHERE game_id = $1
            ORDER BY move_number ASC
            `,
            [gameId]
        );
        return result.rows;
    };

    //-----Player Ratings-----

    export const getRating = async (userId: string): Promise<PlayerRatingRow | null> => {
        const result = await pool.query<PlayerRatingRow>(
            `SELECT ${RATING_SELECT_COLUMNS} FROM player_ratings WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] ?? null;
    };

    export const getRatingOrDefault = async (userId: string): Promise<PlayerRatingRow> => {
        const existing = await getRating(userId);
        if (existing) return existing;
    
        // Upsert nếu chưa có row (user mới chưa chơi ván nào)
        const result = await pool.query<PlayerRatingRow>(
            `
            INSERT INTO player_ratings (user_id)
            VALUES ($1)
            RETURNING ${RATING_SELECT_COLUMNS}
            `,
            [userId]
        );
        if (!result.rows[0]) throw new Error("Failed to create player rating");
        return result.rows[0];
    };


    export const updateRating = async (data: UpdateRatingData): Promise<PlayerRatingRow> => {
        const { userId, newRating, result } = data;
        await getRatingOrDefault(userId);
    
        // Dùng CASE WHEN trong SQL thay vì string interpolation — clean hơn, không rủi ro
        const queryResult = await pool.query<PlayerRatingRow>(
            `
            UPDATE player_ratings SET
                rating          = $2,
                wins            = wins   + CASE WHEN $3 = 'win'  THEN 1 ELSE 0 END,
                losses          = losses + CASE WHEN $3 = 'loss' THEN 1 ELSE 0 END,
                draws           = draws  + CASE WHEN $3 = 'draw' THEN 1 ELSE 0 END,
                games_played    = games_played + 1,
                last_rated_at   = now(),
                updated_at      = now()
            WHERE user_id = $1
            RETURNING ${RATING_SELECT_COLUMNS}
            `,
            [userId, newRating, result]
        );
        if (!queryResult.rows[0]) throw new Error("Failed to update rating");
        return queryResult.rows[0];
    };

    //------Rating History------

    export const insertRatingHistory = async (
        userId: string,
        gameId: string,
        ratingBefore: number,
        ratingAfter: number
    ): Promise<void> => {
        await pool.query(
            `
            INSERT INTO rating_history (user_id, game_id, rating_before, rating_after, rating_change)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [userId, gameId, ratingBefore, ratingAfter, ratingAfter - ratingBefore]
        );
    };

    export const getRatingHistory = async (userId: string, limit = 20) => {
        const result = await pool.query(
            `
            SELECT
                id,
                user_id         AS "userId",
                game_id         AS "gameId",
                rating_before   AS "ratingBefore",
                rating_after    AS "ratingAfter",
                rating_change   AS "ratingChange",
                created_at      AS "createdAt"
            FROM rating_history
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            `,
            [userId, limit]
        );
        return result.rows;
    };
    
