import { filterMessage } from "../utils/sensitive-words-filter";

export const chatFilter = async (message: string) => {
    if (!message) return "";

    const MAX_CHAT_LENGTH = 300;
    message = message
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/<[^>]*>?/gm, "")
        .trim()
        .replace(/\s+/g, " ") // Remove redundant spaces
        .replace(/(.)\1{5,}/g, "$1$1$1")
        .slice(0, MAX_CHAT_LENGTH);

    return message;
}