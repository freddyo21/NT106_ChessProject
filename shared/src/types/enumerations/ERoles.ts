export enum ERoles {
    ADMIN = "admin",
    PLAYER = "player",
    GUEST = "guest"
}

export const roleLabels: Record<ERoles, string> = {
    [ERoles.ADMIN]: "Admin",
    [ERoles.PLAYER]: "Player",
    [ERoles.GUEST]: "Guest",
};

export function getRoleLabel(role: ERoles): string {
    return roleLabels[role] || "Unknown";
}