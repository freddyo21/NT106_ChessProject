import { DEFAULT_ELO, IUser, User, UserResponseSchema, UserSchema } from "@zess-online-chess/shared";
import { pool } from "../config/database.config";
import { Exception } from "../exceptions";

const USER_SELECT_COLUMNS = `
    u."id",
    u."name",
    u."email",
    u."username",
    u."password_hash" AS "passwordHash",
    u."elo",
    u."status",
    u."is_verified" AS "isVerified",
    u."created_at" AS "createdAt",
    u."updated_at" AS "updatedAt",
    u."last_login" AS "lastLogin"
`;

export const findById = async (id: string) => {
    const query = `
        SELECT ${USER_SELECT_COLUMNS}, r.name AS role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
        LIMIT 1
    `;
    const result = await pool.query<IUser>(query, [id]);
    const user = result.rows[0] ?? null;
    if (!user) return null;

    return UserSchema.parse(user);
};

export const findByEmail = async (email: string) => {
    const query = `
        SELECT ${USER_SELECT_COLUMNS}, r.name AS role
        FROM "users" u
        JOIN "roles" r ON u.role_id = r.id
        WHERE u.email = $1
        LIMIT 1
    `;
    const result = await pool.query<IUser>(query, [email]);
    const user = result.rows[0] ?? null;
    if (!user) return null;

    return UserSchema.parse(user);
};

export const findByUsername = async (username: string) => {
    const query = `
        SELECT ${USER_SELECT_COLUMNS}, r.name AS role
        FROM "users" u
        JOIN "roles" r ON u.role_id = r.id
        WHERE u.username = $1
        LIMIT 1
    `;
    const result = await pool.query<IUser>(query, [username]);
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

    const user = await pool.query<IUser>(
        `
            WITH "inserted_user" AS (
                -- New accounts always start from shared DEFAULT_ELO so DB rows match frontend rank display.
                INSERT INTO "users" ("name", "username", "email", "password_hash", "elo")
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            )
            SELECT 
                iu."id",
                iu."name",
                iu."email",
                iu."username",
                iu."password_hash" AS "passwordHash",
                iu."elo",
                r."name" AS "role",
                iu."status",
                iu."is_verified" AS "isVerified",
                iu."created_at" AS "createdAt",
                iu."updated_at" AS "updatedAt",
                iu."last_login" AS "lastLogin"
            FROM "inserted_user" iu
            JOIN "roles" r ON iu."role_id" = r."id";
        `,
        [name, username, email, passwordHash, DEFAULT_ELO]
    ).then(result => result.rows[0] ?? null);

    if (user) {
        const { passwordHash, ...userWithoutHash } = user;
        return UserResponseSchema.parse(userWithoutHash);
    }

    throw new Exception("Failed to create user", 500, "InternalServerError");
};

export const update = async (id: string, data: Partial<User>) => {
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
        UPDATE users u
        SET ${fields.join(", ")}
        WHERE u.id = $${placeholderIndex}
        RETURNING ${USER_SELECT_COLUMNS}, r.name AS role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $${placeholderIndex}
    `;

    const result = await pool.query<IUser>(query, values);
    const user = result.rows[0] ?? null;
    if (!user) return null;

    return UserResponseSchema.parse(user);
};

export const updateElo = async (id: string, elo: number) => {
    // Elo update is isolated here so game-finalization code does not hand-build SQL.
    const result = await pool.query<IUser>(
        `
            UPDATE "users" u
            SET "elo" = $2,
                "updated_at" = NOW()
            FROM "roles" r
            WHERE u."id" = $1
              AND u."role_id" = r."id"
            RETURNING ${USER_SELECT_COLUMNS}, r."name" AS "role"
        `,
        [id, elo]
    );

    const user = result.rows[0] ?? null;
    if (!user) return null;

    return UserResponseSchema.parse(user);
};
