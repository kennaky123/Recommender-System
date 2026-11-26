import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { seedPostgresDefaults } from './store';

async function migrate() {
  console.log('[Migrate] Applying PostgreSQL schema...');
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(sql);
  await seedPostgresDefaults();
  const { rows } = await pool.query('SELECT COUNT(*)::int AS movies FROM movies');
  console.log(`[Migrate] Done. Movies in PostgreSQL: ${rows[0].movies}`);
  await pool.end();
}

migrate().catch((err) => {
  console.error('[Migrate] Failed:', err.message);
  console.error('Make sure PostgreSQL is running (e.g. "npm run db:up" from root).');
  process.exit(1);
});
