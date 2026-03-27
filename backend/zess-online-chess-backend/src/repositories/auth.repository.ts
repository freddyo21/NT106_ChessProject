import { pool } from "../config/database.config";
import { AuthRow } from "../entities/types/AuthRow";
import bcrypt from "bcrypt";
import { UserRow } from "../entities/types/UserRow";

export const login = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query<AuthRow>(
        `
        SELECT id, email, password_hash
        FROM users
        WHERE email = $1
        LIMIT 1
        `,
        [normalizedEmail]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const user = result.rows[0];

    if (!user) {
        return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
        return null;
    }

    return {
        id: user.id,
        email: user.email
    };
};

export const register = async (
    email: string,
    hashedPassword: string
) => {
    const result = await pool.query<Pick<UserRow, "id" | "email">>(
        `
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email
        `,
        [email, hashedPassword]
    );

    return result.rows[0];
}