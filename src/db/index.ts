import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// IMPORTANT: never throw while this module is imported (it would crash the
// whole serverless function before a route's try/catch can answer with JSON).

function needsSsl(connectionString: string): boolean {
  return (
    /sslmode=require/i.test(connectionString) ||
    /neon\.tech|supabase\.|railway\.|render\.com|amazonaws\.com/i.test(connectionString)
  );
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "[db] DATABASE_URL is not set. Add it in your hosting provider's Environment Variables and redeploy."
    );
  }
  return new Pool({
    connectionString,
    ...(connectionString && needsSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {}),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __chazSchemaReady?: Promise<void>;
};

const rawPool: Pool = globalForDb.__arenaNextJsPostgresqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = rawPool;
}

// Self-healing schema: creates any missing table / column the first time the
// database is used, so a fresh Neon database (or one created before a newer
// version of the app) works without running `drizzle-kit push` by hand.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cards (
  id serial PRIMARY KEY,
  card_name text NOT NULL,
  set_name text DEFAULT '',
  card_number text DEFAULT '',
  rarity text DEFAULT '',
  price real DEFAULT 0,
  quantity integer DEFAULT 1,
  buy_pct real DEFAULT 0,
  buy_price real DEFAULT 0,
  variant text DEFAULT 'Normal',
  condition text DEFAULT 'NM',
  tcg text DEFAULT 'pokemon',
  tcgplayer_id text DEFAULT '',
  product_id text DEFAULT '',
  image_url text DEFAULT '',
  source_file text DEFAULT '',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sale_requests (
  id serial PRIMARY KEY,
  requester_name text NOT NULL,
  requester_contact text NOT NULL DEFAULT '',
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  channel text DEFAULT 'in-app',
  total_value real DEFAULT 0,
  item_count integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
ALTER TABLE sale_requests ADD COLUMN IF NOT EXISTS channel text DEFAULT 'in-app';
CREATE TABLE IF NOT EXISTS request_items (
  id serial PRIMARY KEY,
  request_id integer NOT NULL,
  card_id integer NOT NULL,
  card_name text NOT NULL DEFAULT '',
  set_name text DEFAULT '',
  card_number text DEFAULT '',
  rarity text DEFAULT '',
  condition text DEFAULT '',
  variant text DEFAULT '',
  quantity integer DEFAULT 1,
  price_each real DEFAULT 0
);
CREATE TABLE IF NOT EXISTS upload_batches (
  id serial PRIMARY KEY,
  filename text NOT NULL DEFAULT '',
  row_count integer DEFAULT 0,
  new_cards integer DEFAULT 0,
  merged_cards integer DEFAULT 0,
  total_value real DEFAULT 0,
  created_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_settings (
  id integer PRIMARY KEY,
  admin_email text DEFAULT '',
  admin_whatsapp text DEFAULT '',
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cards_name_lower_idx ON cards (lower(card_name));
CREATE INDEX IF NOT EXISTS request_items_request_idx ON request_items (request_id);
`;

export function ensureSchema(): Promise<void> {
  if (!globalForDb.__chazSchemaReady) {
    globalForDb.__chazSchemaReady = rawPool
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((e) => {
        // allow a retry on the next request
        globalForDb.__chazSchemaReady = undefined;
        throw e;
      });
  }
  return globalForDb.__chazSchemaReady;
}

// Every route uses `pool.query` / `pool.connect`; wrap them so the schema is
// guaranteed to exist first (no-op after the first successful run).
export const pool: Pool = new Proxy(rawPool, {
  get(target, prop, receiver) {
    if (prop === "query" || prop === "connect") {
      return async (...args: unknown[]) => {
        await ensureSchema();
        const fn = (target as unknown as Record<string, (...a: unknown[]) => unknown>)[prop as string];
        return fn.apply(target, args);
      };
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export const db = drizzle(rawPool);
