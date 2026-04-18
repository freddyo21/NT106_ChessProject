import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

export const pool = new Pool(
    {
        ...process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
            host: process.env.DB_HOST || "localhost",
            port: Number(process.env.DB_PORT || 5432),
            user: process.env.DB_USER || "postgres",
            password: process.env.DB_PASSWORD || "postgres",
            database: process.env.DB_NAME || "chess_db",
        },
        ssl: {
            rejectUnauthorized: process.env.NODE_ENV === "production",
        }
    }
);

// const supabaseUrl = "https://djgqiiflytziciyfrcfw.supabase.co";
// const supabaseKey = process.env.SUPABASE_KEY || "";
// export const supabase = createClient(supabaseUrl, supabaseKey);