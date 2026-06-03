import { createHash } from "node:crypto";
import { pool } from "../config/database.config";

export type AuthTokenType = "refresh" | "password_reset" | "email_verify";

type AuthTokenRow = {
    userId: string;
};

let ensureTablePromise: Promise<void> | null = null;

const hashToken = (token: string) => {
    return createHash("sha256").update(token).digest("hex");
};

const ensureAuthTokenTable = async () => {
    ensureTablePromise ??= pool.query(`
        CREATE TABLE IF NOT EXISTS auth_tokens (
            token_hash CHAR(64) PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(32) NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            revoked_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type ON auth_tokens(user_id, type);
        CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry ON auth_tokens(expires_at);
    `).then(() => undefined);

    await ensureTablePromise;
};

export const storeAuthToken = async (
    token: string,
    userId: string,
    type: AuthTokenType,
    expiresAtMs: number
) => {
    await ensureAuthTokenTable();

    await pool.query(
        `
            INSERT INTO auth_tokens (token_hash, user_id, type, expires_at)
            VALUES ($1, $2, $3, $4)
        `,
        [hashToken(token), userId, type, new Date(expiresAtMs)]
    );
};

export const findValidAuthToken = async (token: string, type: AuthTokenType) => {
    await ensureAuthTokenTable();

    const result = await pool.query<AuthTokenRow>(
        `
            SELECT user_id AS "userId"
            FROM auth_tokens
            WHERE token_hash = $1
                AND type = $2
                AND revoked_at IS NULL
                AND expires_at > NOW()
            LIMIT 1
        `,
        [hashToken(token), type]
    );

    return result.rows[0] ?? null;
};

export const revokeAuthToken = async (token: string, type?: AuthTokenType) => {
    await ensureAuthTokenTable();

    await pool.query(
        `
            UPDATE auth_tokens
            SET revoked_at = NOW()
            WHERE token_hash = $1
                AND ($2::varchar IS NULL OR type = $2)
                AND revoked_at IS NULL
        `,
        [hashToken(token), type ?? null]
    );
};

export const deleteExpiredAuthTokens = async (type?: AuthTokenType) => {
    await ensureAuthTokenTable();

    await pool.query(
        `
            DELETE FROM auth_tokens
            WHERE expires_at <= NOW()
                AND ($1::varchar IS NULL OR type = $1)
        `,
        [type ?? null]
    );
};
