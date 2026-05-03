
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

const inviteCodes = new Map<string, InviteCodeRecord>();

const cleanupExpiredInviteCodes = () => {
    const now = Date.now();

    for (const [code, record] of inviteCodes.entries()) {
        if (record.expiresAt <= now) {
            inviteCodes.delete(code);
        }
    }
};

const generateInviteCode = () => {
    const randomBytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
    let code = "";

    for (const randomByte of randomBytes) {
        const index = randomByte % INVITE_CODE_ALPHABET.length;
        code += INVITE_CODE_ALPHABET.charAt(index);
    }

    return code;
};

const normalizeInviteCode = (code: string) => {
    return code.replace(/\s+/g, "").toUpperCase();
};

export const createInvitationCode = (roomId: string) => {
    cleanupExpiredInviteCodes();

    const expiresAt = Date.now() + INVITE_CODE_TTL_MS;
    let code = generateInviteCode();
    let attempts = 0;

    while (inviteCodes.has(code) && attempts < 5) {
        code = generateInviteCode();
        attempts += 1;
    }

    inviteCodes.set(code, { roomId, expiresAt });

    return {
        code,
        expiresAt,
    };
};

export const verifyInvitationCode = (roomId: string, code: string): InviteCodeValidationResult => {
    cleanupExpiredInviteCodes();

    const normalizedCode = normalizeInviteCode(code);
    const invitation = inviteCodes.get(normalizedCode);

    if (!invitation) {
        return {
            isValid: false,
            error: "Invalid invitation code",
        };
    }

    if (invitation.expiresAt <= Date.now()) {
        inviteCodes.delete(normalizedCode);
        return {
            isValid: false,
            error: "Invitation code has expired (5 minutes)",
        };
    }

    if (invitation.roomId !== roomId) {
        return {
            isValid: false,
            error: "Invitation code does not match this room",
        };
    }

    return { isValid: true };
};