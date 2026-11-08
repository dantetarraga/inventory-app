import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { runMigrations } from '../src/db/migrate';

/** Loads ../../.env without overriding variables already set (e.g. in CI). */
function loadDotEnv() {
  const file = path.resolve(import.meta.dirname, '../../../.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}

export function testDatabaseUrl() {
  loadDotEnv();
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run the API tests');
  const url = new URL(base);
  if (!process.env.TEST_DATABASE_URL) url.pathname = '/stockpro_test';
  return url.toString();
}

export default async function setup() {
  const url = new URL(testDatabaseUrl());
  const dbName = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  await runMigrations(url.toString());
  process.env.TEST_DATABASE_URL_RESOLVED = url.toString();
}
