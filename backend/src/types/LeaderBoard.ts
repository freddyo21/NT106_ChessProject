export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    avatarUrl: string | null;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    gamesPlayed: number;
    winRate: number;
}

export interface LeaderboardOptions {
    limit?: number;
    offset?: number;
    minGamesPlayed?: number;
}

export interface LeaderboardPage {
    entries: LeaderboardEntry[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface PlayerLeaderboardInfo {
    rank: number | null;
    nearbyPlayers: LeaderboardEntry[];
}

export interface PlayerProfileStats {
    userId: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    gamesPlayed: number;
    winRate: number;
}
