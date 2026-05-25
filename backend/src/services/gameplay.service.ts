import { randomBytes } from "node:crypto";
import { redisClient } from "../config/redis.config";

const INVITE_CODE_TTL_MS = 5 * 60 * 1000;
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type InviteCodeRecord = {
    roomId: string;
    expiresAt: number;
};

type InviteCodeValidationResult = {
    isValid: boolean;
    error?: string;
};

const memoryInviteCodes = new Map<string, InviteCodeRecord>();

const isRedisEnabled = () => process.env.REDIS_ENABLED === "true";

const getInviteCodeKey = (code: string) => `invite:code:${code}`;

const cleanupExpiredMemoryInviteCodes = () => {
    const now = Date.now();

    for (const [code, record] of memoryInviteCodes.entries()) {
        if (record.expiresAt <= now) {
            memoryInviteCodes.delete(code);
        }
    }
};

const generateInviteCode = () => {
    const bytes = randomBytes(INVITE_CODE_LENGTH);
    let code = "";

    for (const byte of bytes) {
        code += INVITE_CODE_ALPHABET.charAt(byte % INVITE_CODE_ALPHABET.length);
    }

    return code;
};

const normalizeInviteCode = (code: string) => {
    return code.replace(/\s+/g, "").toUpperCase();
};

export const createInvitationCode = async (roomId: string) => {
    const expiresAt = Date.now() + INVITE_CODE_TTL_MS;
    let code = generateInviteCode();
    let attempts = 0;

    if (isRedisEnabled()) {
        while (attempts < 5) {
            const existing = await redisClient.get(getInviteCodeKey(code));

            if (!existing) {
                break;
            }

            code = generateInviteCode();
            attempts += 1;
        }

        await redisClient.set(
            getInviteCodeKey(code),
            JSON.stringify({ roomId, expiresAt }),
            { PX: INVITE_CODE_TTL_MS }
        );

        return { code, expiresAt };
    }

    cleanupExpiredMemoryInviteCodes();

    while (memoryInviteCodes.has(code) && attempts < 5) {
        code = generateInviteCode();
        attempts += 1;
    }

    memoryInviteCodes.set(code, { roomId, expiresAt });

    return { code, expiresAt };
};

export const verifyInvitationCode = async (
    roomId: string,
    code: string
): Promise<InviteCodeValidationResult> => {
    const normalizedCode = normalizeInviteCode(code);

    if (isRedisEnabled()) {
        const rawInvitation = await redisClient.get(getInviteCodeKey(normalizedCode));

        if (!rawInvitation) {
            return { isValid: false, error: "Invalid invitation code" };
        }

        const invitation = JSON.parse(rawInvitation) as InviteCodeRecord;

        if (invitation.roomId !== roomId) {
            return { isValid: false, error: "Invitation code does not match this room" };
        }

        return { isValid: true };
    }

    cleanupExpiredMemoryInviteCodes();

    const invitation = memoryInviteCodes.get(normalizedCode);

    if (!invitation) {
        return { isValid: false, error: "Invalid invitation code" };
    }

    if (invitation.expiresAt <= Date.now()) {
        memoryInviteCodes.delete(normalizedCode);
        return { isValid: false, error: "Invitation code has expired (5 minutes)" };
    }

    if (invitation.roomId !== roomId) {
        return { isValid: false, error: "Invitation code does not match this room" };
    }

    return { isValid: true };
};