import { IUser, UserSchema } from "@zess-online-chess/shared";
import { pool } from "../config/database.config";
import { User } from "../types/IUserResponse";
import { Exception } from "../exceptions";

const USER_SELECT_COLUMNS = `
    id,
    name,
    email,
    username,
    password_hash AS "passwordHash",
    elo,
    role,
    status,
    is_verified AS "isVerified",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    last_login AS "lastLogin"
`;

export const findByEmail = async (email: string) => {
    const query = `
        SELECT ${USER_SELECT_COLUMNS}
        FROM users
        WHERE email = $1
        LIMIT 1
    `;
    const result = await pool.query<IUser>(query, [email]);
    const user = result.rows[0] ?? null;
    if (!user) return null;

    return UserSchema.parse(user);
};

type CreateUserData = Pick<IUser, "name" | "username" | "email" | "passwordHash">;
export const create = async (data: Required<CreateUserData>) => {
    const { name, username, email, passwordHash } = data;

    if (!name || !username || !email || !passwordHash) {
        throw new Exception("Missing required fields", 400);
    }

    const result = await pool.query<IUser>(
        `
        INSERT INTO users (name, username, email, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING ${USER_SELECT_COLUMNS}
        `,
        [name, username, email, passwordHash]
    );

    return UserSchema.parse(result.rows[0]);
}

export const update = async (id: number, data: Partial<User>) => {
    const fields: string[] = [];
    const values: unknown[] = [];
    let placeholderIndex = 1;

    const columnMap: Record<string, string> = {
        "name": "name",
        "username": "username",
        "email": "email",
        "passwordHash": "password_hash"
        // Tuyệt đối không đưa "id" vào đây để tránh bị ghi đè
    };

    // Duyệt qua các key trong data để build query động
    for (const [key, value] of Object.entries(data)) {
        const columnName = columnMap[key];

        // Chỉ xử lý nếu key nằm trong danh sách cho phép và value không undefined
        if (columnName && value !== undefined) {
            fields.push(`${columnName} = $${placeholderIndex++}`);
            values.push(value);
        }
    }

    if (fields.length === 0) return null; // Không có gì để update

    values.push(id); // Tham số cuối cùng cho WHERE id = $x
    const query = `
        UPDATE users
        SET ${fields.join(", ")}
        WHERE id = $${placeholderIndex}
        RETURNING ${USER_SELECT_COLUMNS}
    `;

    const result = await pool.query<IUser>(query, values);
    const user = result.rows[0] ?? null;
    if (!user) return null;

    return UserSchema.parse(user);
}
