export interface PlayerProfile {
    id: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    isOnline: boolean;
    status: "offline" | "online" | "in_game";
    lastSeenAt: Date | null;
    createdAt: Date;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    gamesPlayed: number;
}

export interface UpdateProfileData {
    username?: string;
    avatarUrl?: string;
    bio?: string;
}