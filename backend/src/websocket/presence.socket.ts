import { Socket } from "socket.io";
import { DEFAULT_ELO } from "@zess-online-chess/shared";
import { Logger } from "../utils/Logger";

type PresenceUser = {
    userId: string;
    username: string;
    displayName: string;
    elo: number;
    status: "online" | "playing" | "idle";
};

const onlineUsers = new Map<string, PresenceUser>();
const userSocketCounts = new Map<string, number>();
const logger = new Logger("presence-socket");

function getPresenceUser(socket: Socket): PresenceUser | null {
    const user = socket.data.user;
    const userId = user?.id;

    if (!userId) {
        return null;
    }

    return {
        userId,
        username: user.username || "unknown",
        displayName: user.name || user.username || "Nguoi choi",
        elo: typeof user.elo === "number" ? user.elo : DEFAULT_ELO,
        status: "online",
    };
}

function getPresenceList() {
    return [...onlineUsers.values()].sort((left, right) =>
        left.displayName.localeCompare(right.displayName)
    );
}

export function presenceSocket(socket: Socket) {
    const presenceUser = getPresenceUser(socket);

    if (!presenceUser) {
        logger.error("Socket connected without presence user", { socketId: socket.id });
        return;
    }

    const currentCount = userSocketCounts.get(presenceUser.userId) ?? 0;
    userSocketCounts.set(presenceUser.userId, currentCount + 1);
    onlineUsers.set(presenceUser.userId, presenceUser);

    // Gửi danh sách online hiện tại cho socket mới và broadcast cho các client khác trong lobby.
    socket.emit("presence:list", getPresenceList());
    socket.broadcast.emit("presence:user_online", presenceUser);

    socket.on("presence:list", (callback?: (users: PresenceUser[]) => void) => {
        // Cho frontend chủ động refresh danh sách user online khi mở lại Lobby.
        const users = getPresenceList();
        callback?.(users);
        socket.emit("presence:list", users);
    });

    socket.on("disconnect", () => {
        const nextCount = Math.max((userSocketCounts.get(presenceUser.userId) ?? 1) - 1, 0);

        if (nextCount > 0) {
            userSocketCounts.set(presenceUser.userId, nextCount);
            return;
        }

        userSocketCounts.delete(presenceUser.userId);
        onlineUsers.delete(presenceUser.userId);

        // Chỉ báo offline khi user thật sự hết socket active, tránh nháy khi reconnect.
        socket.nsp.emit("presence:user_offline", {
            userId: presenceUser.userId,
            timestamp: new Date().toISOString(),
        });
    });
}
