import { calculateMatchElo, DEFAULT_ELO } from "@zess-online-chess/shared";
import * as userRepository from "../repositories/user.repository";

type ApplyMatchEloResultInput = {
    whiteUserId: string;
    blackUserId: string;
    whiteElo?: number;
    blackElo?: number;
    whiteGamesPlayed?: number;
    blackGamesPlayed?: number;
    result: "white" | "black" | "draw";
};

export async function applyMatchEloResult(input: ApplyMatchEloResultInput) {
    // Chuẩn hóa input trước khi gọi shared Elo util; user thiếu Elo sẽ bắt đầu ở DEFAULT_ELO.
    const matchEloInput = {
        whiteElo: input.whiteElo ?? DEFAULT_ELO,
        blackElo: input.blackElo ?? DEFAULT_ELO,
        result: input.result,
        // exactOptionalPropertyTypes không cho truyền undefined, nên chỉ spread khi có number thật.
        ...(typeof input.whiteGamesPlayed === "number"
            ? { whiteGamesPlayed: input.whiteGamesPlayed }
            : {}),
        ...(typeof input.blackGamesPlayed === "number"
            ? { blackGamesPlayed: input.blackGamesPlayed }
            : {}),
    };
    const calculation = calculateMatchElo(matchEloInput);

    // Cập nhật hai người chơi song song vì kết quả Elo của hai bên độc lập sau khi đã tính xong.
    const [whiteUser, blackUser] = await Promise.all([
        userRepository.updateElo(input.whiteUserId, calculation.whiteNextElo),
        userRepository.updateElo(input.blackUserId, calculation.blackNextElo),
    ]);

    return {
        ...calculation,
        whiteUser,
        blackUser,
    };
}
