const FLEXIBLE_SEPARATOR = "[\\s._\\-!@#$%^&*+=|~]*";

export const sensitiveWords = [
    "dit",
    "dit me",
    "du me",
    "deo",
    "dech",
    "dach",
    "dm",
    "dmm",
    "dcm",
    "dcmm",
    "clm",
    "vcl",
    "vkl",
    "vcc",
    "vl",
    "cac",
    "cak",
    "buoi",
    "lon",
    "loz",
    "cut",
    "ngu lon",
    "oc cho",
    "nao cho",
    "do cho",
    "cho chet",
    "thang cho",
    "con cho",
    "khon nan",
    "mat day",
    "vo hoc",
    "suc vat",
    "can ba",
    "rac ruoi",
    "bo lao",
    "lao toet",
    "me may",
    "ma may",
    "bo may",
    "cave",
    "con diem",
    "con di",
    "bu cu",
    "cuong hiep",
    "chet me",
    "cut me",
    "im me mom",
    "cam mom"
];

const CHARACTER_VARIANTS: Record<string, string> = {
    a: "aàáạảãâầấậẩẫăằắặẳẵ4@",
    b: "b8",
    c: "c",
    d: "dđ",
    e: "eèéẹẻẽêềếệểễ3",
    g: "g9",
    h: "h",
    i: "iìíịỉĩ1!|l",
    k: "k",
    l: "l1i!|",
    m: "m",
    n: "n",
    o: "oòóọỏõôồốộổỗơờớợởỡ0",
    p: "p",
    q: "q",
    r: "r",
    s: "s5$",
    t: "t7+",
    u: "uùúụủũưừứựửữ",
    v: "v",
    x: "x"
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSeed = (value: string) =>
    value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");

const createWordRegex = (word: string) => {
    const normalizedWord = normalizeSeed(word);

    const body = normalizedWord
        .split("")
        .map((character) => {
            if (character === " ") {
                return FLEXIBLE_SEPARATOR;
            }

            const variants = CHARACTER_VARIANTS[character] ?? character;
            return `[${escapeRegex(variants)}]`;
        })
        .join(FLEXIBLE_SEPARATOR);

    return new RegExp(`(^|[^\\p{L}\\p{N}])(${body})(?=$|[^\\p{L}\\p{N}])`, "giu");
};

const compiledSensitivePatterns = Array.from(new Set(sensitiveWords.map(normalizeSeed)))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .map((word) => createWordRegex(word));

const maskFragment = (value: string) => value.replace(/[\p{L}\p{N}]/gu, "*");

export const containsSensitiveWord = (message: string) => {
    if (typeof message !== "string" || !message.trim()) {
        return false;
    }

    const normalizedMessage = message.normalize("NFKC");

    return compiledSensitivePatterns.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(normalizedMessage);
    });
};

export const filterMessage = (message: string) => {
    if (typeof message !== "string" || !message.trim()) {
        return "";
    }

    let filteredMessage = message.normalize("NFKC");

    for (const pattern of compiledSensitivePatterns) {
        pattern.lastIndex = 0;
        filteredMessage = filteredMessage.replace(pattern, (_, prefix: string, matchedWord: string) => {
            return `${prefix}${maskFragment(matchedWord)}`;
        });
    }

    return filteredMessage;
};