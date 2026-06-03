export enum ERoles {
    ADMIN = "admin",
    USER = "user",
    GUEST = "guest"
}

export const roleLabels: Record<ERoles, string> = {
    [ERoles.ADMIN]: "Admin",
    [ERoles.USER]: "User",
    [ERoles.GUEST]: "Guest",
};

export function getRoleLabel(role: ERoles): string {
    return roleLabels[role] || "Unknown";
}