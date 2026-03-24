import { pool } from "../config/database.config";
import { UserRow } from "../entity/types/UserRow";

export const findByEmail = async (email: string) => {
    const result = await pool.query<UserRow>(
        `
            SELECT *
            FROM users
            WHERE email = $1
            LIMIT 1
        `,
        [email]
    );

    return result.rows[0] ?? null;
}