// Validate DECIMAL(9,6): max 9 chữ số, 6 chữ số thập phân
export const decimal96 = (num: number) => {
    const str = Math.abs(num).toFixed(6); // Làm tròn 6 chữ số
    return str.replace('.', '').length <= 9; // Loại bỏ dấu . và kiểm tra tổng
};

type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
    ? `${Lowercase<T>}${Capitalize<SnakeToCamelCase<U>>}`
    : S;

export type SnakeToCamelObject<T> = T extends any[]
    ? SnakeToCamelObject<T[number]>[]
    : T extends Record<string, any>
    ? string extends keyof T
    ? T  // Has index signature (dynamic keys), keep as-is
    : { [K in keyof T as K extends string ? SnakeToCamelCase<K> : K]: SnakeToCamelObject<T[K]> }
    : T;

export const snakeToCamelTransform = <T>(obj: T): SnakeToCamelObject<T> => {
    if (Array.isArray(obj)) {
        return obj.map((v) => snakeToCamelTransform(v)) as any;
    }
    if (obj !== null && typeof obj === "object") {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            const camelKey = key.replace(/(_\w)/g, (m) => m[1].toUpperCase());
            result[camelKey] = snakeToCamelTransform(value);
        }
        return result;
    }
    return obj as any;
};