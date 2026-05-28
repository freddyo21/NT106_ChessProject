import bcrypt from "bcrypt";

const SALT_ROUNDS = 13;

export async function hashPassword(password: string, saltRounds: number = SALT_ROUNDS): Promise<string> {
    return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}
