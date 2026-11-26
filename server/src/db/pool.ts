import { Pool } from 'pg';
import { DATABASE_URL } from '../config';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 2500,
  max: 10,
});

pool.on('error', (err) => {
  console.warn('[PostgreSQL Pool Warning]', err.message);
});
