import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const PORT = Number(process.env.PORT) || 4000;
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://spacex:spacex_secret@localhost:5432/spacex_vod';
export const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
