import { DatabaseConnection } from '../repositories/DatabaseConnection';

async function migrate() {
  console.log('[Migrate] Applying PostgreSQL schema...');
  const db = DatabaseConnection.getInstance();
  await db.applySchema();
  await db.seedDefaults();
  const { rows } = await db.pool.query(
    'SELECT COUNT(*)::int AS movies FROM movies'
  );
  console.log(`[Migrate] Done. Movies in PostgreSQL: ${rows[0].movies}`);
  await db.close();
}

migrate().catch((err) => {
  console.error('[Migrate] Failed:', (err as Error).message);
  console.error(
    'Make sure PostgreSQL is running (e.g. "npm run db:up" from root).'
  );
  process.exit(1);
});
