// Throwaway local PostgreSQL 17 for database tests. Never touches the cloud:
// it starts a server on 127.0.0.1, in .test-db/ inside this project, applies
// tests/db/supabase-shim.sql + our migration, and deletes everything on stop.
import { randomUUID } from "node:crypto";
import { readFileSync, rmdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const ROOT = new URL("../../", import.meta.url);
const SHIM = new URL("tests/db/supabase-shim.sql", ROOT);
const MIGRATION = new URL("supabase/migrations/20261005120000_phase5a_orders.sql", ROOT);

export type Role = "anon" | "authenticated" | "service_role";

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}

export async function startTestDatabase() {
  const port = await freePort();
  const dir = fileURLToPath(new URL(`.test-db/run-${process.pid}-${Date.now()}`, ROOT));
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    // Supabase databases are UTF-8; Windows would otherwise default to WIN1252.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });

  let pool: pg.Pool | null = null;
  const stop = async () => {
    await pool?.end().catch(() => {});
    await server.stop().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    try {
      rmdirSync(fileURLToPath(new URL(".test-db", ROOT))); // only succeeds when empty
    } catch {
      // other runs still present
    }
  };

  try {
    await server.initialise();
    await server.start();
    await server.createDatabase("rnfc_test");
    pool = new pg.Pool({ host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "rnfc_test", max: 40 });
    await pool.query(readFileSync(SHIM, "utf8"));
    await pool.query(readFileSync(MIGRATION, "utf8"));
  } catch (error) {
    // Never leave a server running if setup fails.
    await stop();
    throw error;
  }

  return { pool, stop };
}

/**
 * Run `fn` in one transaction as a Supabase API role, the way Supabase does per
 * request: switch role and set the JWT claims (sub = signed-in user id).
 */
export async function asRole<T>(
  pool: pg.Pool,
  role: Role,
  userId: string | null,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role, ...(userId ? { sub: userId } : {}) }),
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Create a Supabase-style user (and optionally make them an admin). Returns the user id. */
export async function createUser(pool: pg.Pool, { admin = false } = {}) {
  const id = randomUUID();
  await pool.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@test.local`]);
  if (admin) await pool.query("insert into public.admin_users (user_id, display_name) values ($1, 'Bam (test)')", [id]);
  return id;
}
