export const DEFAULT_ELO = 1200;
export const MIN_ELO = 100;
export const PROVISIONAL_GAMES_THRESHOLD = 20;

export type EloScore = 0 | 0.5 | 1;
export type EloGameResult = "win" | "loss" | "draw";
export type EloRankTier = "bronze" | "silver" | "gold" | "master";
export type EloRankDivision = 1 | 2 | 3;

export type EloRank = {
    tier: EloRankTier;
    division: EloRankDivision;
    text: string;
};

type EloInput = {
    playerElo: number;
    opponentElo: number;
    gamesPlayed?: number;
};

type EloDeltaInput = EloInput & {
    score: EloScore;
};

type EloResultInput = EloInput & {
    result: EloGameResult;
};

export function getEloKFactor(gamesPlayed = 0, playerElo = DEFAULT_ELO) {
    // K-factor cao cho người mới để Elo ổn định nhanh hơn trong các ván đầu.
    if (gamesPlayed < PROVISIONAL_GAMES_THRESHOLD) {
        return 40;
    }

    // Người chơi Elo cao biến động ít hơn để tránh rank top nhảy quá mạnh.
    if (playerElo >= 2000) {
        return 16;
    }

    return 32;
}

export function getExpectedEloScore(playerElo: number, opponentElo: number) {
    // Công thức expected score chuẩn của Elo, chênh 400 Elo tương đương tỉ lệ thắng khoảng 10:1.
    return 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
}

export function scoreFromResult(result: EloGameResult): EloScore {
    if (result === "win") return 1;
    if (result === "draw") return 0.5;
    return 0;
}

export function calculateEloDelta({
    playerElo,
    opponentElo,
    gamesPlayed = 0,
    score,
}: EloDeltaInput) {
    const expectedScore = getExpectedEloScore(playerElo, opponentElo);
    const kFactor = getEloKFactor(gamesPlayed, playerElo);

    // Delta dương khi kết quả thật tốt hơn kỳ vọng, âm khi kết quả kém hơn kỳ vọng.
    return Math.round(kFactor * (score - expectedScore));
}

export function calculateNextElo(input: EloDeltaInput) {
    // Chặn Elo không tụt dưới ngưỡng tối thiểu để tránh số âm/giá trị vô nghĩa.
    return Math.max(MIN_ELO, input.playerElo + calculateEloDelta(input));
}

export function calculateNextEloFromResult(input: EloResultInput) {
    return calculateNextElo({
        ...input,
        score: scoreFromResult(input.result),
    });
}

export function calculateMatchElo(params: {
    whiteElo: number;
    blackElo: number;
    whiteGamesPlayed?: number;
    blackGamesPlayed?: number;
    result: "white" | "black" | "draw";
}) {
    // Tính đồng thời hai phía để tổng thay đổi cân bằng quanh cùng một kết quả ván.
    const whiteScore: EloScore =
        params.result === "white" ? 1 : params.result === "draw" ? 0.5 : 0;
    const blackScore: EloScore =
        params.result === "black" ? 1 : params.result === "draw" ? 0.5 : 0;

    const whiteNextElo = calculateNextElo({
        playerElo: params.whiteElo,
        opponentElo: params.blackElo,
        gamesPlayed: params.whiteGamesPlayed,
        score: whiteScore,
    });
    const blackNextElo = calculateNextElo({
        playerElo: params.blackElo,
        opponentElo: params.whiteElo,
        gamesPlayed: params.blackGamesPlayed,
        score: blackScore,
    });

    return {
        whiteNextElo,
        blackNextElo,
        whiteDelta: whiteNextElo - params.whiteElo,
        blackDelta: blackNextElo - params.blackElo,
    };
}

export function getRankByElo(elo: number): EloRank {
    // Mapping rank dùng chung cho toàn app: mỗi 100 Elo lên một bậc III -> II -> I.
    if (elo >= 2100) {
        return { tier: "master", division: 1, text: "Master I" };
    }

    if (elo >= 2000) {
        return { tier: "master", division: 2, text: "Master II" };
    }

    if (elo >= 1900) {
        return { tier: "master", division: 3, text: "Master III" };
    }

    if (elo >= 1800) {
        return { tier: "gold", division: 1, text: "Vàng I" };
    }

    if (elo >= 1700) {
        return { tier: "gold", division: 2, text: "Vàng II" };
    }

    if (elo >= 1600) {
        return { tier: "gold", division: 3, text: "Vàng III" };
    }

    if (elo >= 1500) {
        return { tier: "silver", division: 1, text: "Bạc I" };
    }

    if (elo >= 1400) {
        return { tier: "silver", division: 2, text: "Bạc II" };
    }

    if (elo >= 1300) {
        return { tier: "silver", division: 3, text: "Bạc III" };
    }

    if (elo >= 1200) {
        return { tier: "bronze", division: 1, text: "Đồng I" };
    }

    if (elo >= 1100) {
        return { tier: "bronze", division: 2, text: "Đồng II" };
    }

    return { tier: "bronze", division: 3, text: "Đồng III" };
}

export function getEloRankLabel(elo: number) {
    return `${getRankByElo(elo).text} · ${elo}`;
}
