import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

// Return Postgres `numeric` and `bigint` (count) values as strings / numbers consistently.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Anything that can run queries: the root db or an open transaction. */
export type DbOrTx = Database | Tx;

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool };
}
