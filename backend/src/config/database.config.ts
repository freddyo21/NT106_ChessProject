import { Pool } from "pg";

const isProduction = process.env.NODE_ENV === "production";
const useSsl = isProduction || process.env.DATABASE_SSL === "true";

export const pool = new Pool({
    ...(process.env.DATABASE_URL && process.env.DATABASE_URL !== ""
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.DB_HOST || "localhost",
            port: Number(process.env.DB_PORT || 5432),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        }),
    ssl: useSsl
        ? { rejectUnauthorized: false }
        : false,
});

// const supabaseUrl = "https://djgqiiflytziciyfrcfw.supabase.co";
// const supabaseKey = process.env.SUPABASE_KEY || "";
// export const supabase = createClient(supabaseUrl, supabaseKey);
