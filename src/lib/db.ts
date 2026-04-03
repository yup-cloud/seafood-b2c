import { Pool, PoolClient } from "pg";
import { env } from "../config/env";

export const db = new Pool({
  connectionString: env.databaseUrl
});

export type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();

  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function healthcheckDatabase(): Promise<boolean> {
  try {
    await db.query("select 1");
    return true;
  } catch {
    return false;
  }
}
