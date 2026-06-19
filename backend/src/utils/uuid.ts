import { randomBytes } from "node:crypto";

export const generateUuidV7 = (): string => {
    const bytes = randomBytes(16);
    let timestamp = BigInt(Date.now());

    for (let index = 5; index >= 0; index--) {
        bytes[index] = Number(timestamp & 0xffn);
        timestamp >>= 8n;
    }

    bytes[6] = (bytes[6]! & 0x0f) | 0x70;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join("-");
};
