import fs from 'fs';
import path from 'path';
import {
  SEED_MOVIES,
  SEED_RATINGS,
  SEED_USERS,
  SEED_WATCHLIST,
  SEED_WATCH_HISTORY,
} from '../db/seedData';
import { ScryptPasswordHasher } from '../services/auth/ScryptPasswordHasher';
import { DatabaseConnection } from './DatabaseConnection';

/**
 * Single Responsibility: handles DDL schema application and default data seeding.
 */
export class DatabaseSeeder {
  private readonly db: DatabaseConnection;

  public constructor(db: DatabaseConnection) {
    this.db = db;
  }

  public resolveSchemaPath(): string {
    const candidates = [
      path.resolve(__dirname, '..', 'db', 'schema.sql'),
      path.resolve(__dirname, '..', '..', 'src', 'db', 'schema.sql'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return candidates[1];
  }

  public async applySchema(): Promise<void> {
    const schemaSql = fs.readFileSync(this.resolveSchemaPath(), 'utf-8');
    await this.db.pool.query(schemaSql);
  }

  public async seedDefaultsIfEmpty(): Promise<void> {
    await this.ensureDemoAuthUser();
    const { rows } = await this.db.pool.query(
      'SELECT COUNT(*)::int AS cnt FROM movies'
    );
    if (Number(rows[0]?.cnt ?? 0) === 0) {
      await this.seedDefaults();
    }
  }

  public async ensureDemoAuthUser(): Promise<void> {
    const demoCheck = await this.db.pool.query(
      'SELECT id, email, password_hash FROM users WHERE id = 1'
    );
    const hasher = new ScryptPasswordHasher();
    const demoHash = hasher.hash('SpaceX@2026');
    if (demoCheck.rows.length === 0) {
      await this.db.pool.query(
        `INSERT INTO users (id, name, email, password_hash, avatar_url)
         VALUES (1, 'CLAUDE PATTERSON', 'claude@spacex.vod', $1, '/backdrops/claude-patterson.jpg')
         ON CONFLICT (id) DO NOTHING`,
        [demoHash]
      );
    } else if (!demoCheck.rows[0].email || !demoCheck.rows[0].password_hash) {
      await this.db.pool.query(
        `UPDATE users
         SET email = COALESCE(email, 'claude@spacex.vod'),
             password_hash = COALESCE(password_hash, $1)
         WHERE id = 1`,
        [demoHash]
      );
    }
    await this.db.pool.query(
      `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`
    );
  }

  public async seedDefaults(): Promise<void> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const u of SEED_USERS) {
        await client.query(
          `INSERT INTO users (id, name, avatar_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url`,
          [u.id, u.name, u.avatarUrl]
        );
      }

      for (const m of SEED_MOVIES) {
        await client.query(
          `INSERT INTO movies (
            id, movielens_id, tmdb_id, imdb_id, media_type, title, provider,
            release_year, runtime_minutes, age_rating, resolution, genres, tags, moods,
            synopsis, backdrop_url, trailer_youtube_id, seasons_count, episodes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)
          ON CONFLICT (id) DO NOTHING`,
          [
            m.id,
            m.movielensId ?? null,
            m.tmdbId,
            m.imdbId ?? null,
            m.mediaType,
            m.title,
            m.provider,
            m.year,
            m.runtimeMinutes,
            m.ageRating,
            m.resolution,
            m.genres,
            m.tags,
            m.moods,
            m.synopsis,
            m.backdropUrl,
            m.trailerYoutubeId ?? null,
            m.seasonsCount ?? 1,
            JSON.stringify(m.episodes ?? []),
          ]
        );
      }

      await client.query(
        `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`
      );
      await client.query(
        `SELECT setval(pg_get_serial_sequence('movies', 'id'), COALESCE((SELECT MAX(id) FROM movies), 1))`
      );

      for (const r of SEED_RATINGS) {
        await client.query(
          `INSERT INTO ratings (user_id, movie_id, rating, rated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, movie_id) DO NOTHING`,
          [r.userId, r.movieId, r.rating, r.ratedAt]
        );
      }

      for (const w of SEED_WATCHLIST) {
        await client.query(
          `INSERT INTO user_watchlist (user_id, movie_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, movie_id) DO NOTHING`,
          [w.userId, w.movieId]
        );
      }

      for (const h of SEED_WATCH_HISTORY) {
        await client.query(
          `INSERT INTO watch_history (
            user_id, movie_id, progress_seconds, duration_seconds, progress_percent,
            last_season, last_episode, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (user_id, movie_id) DO NOTHING`,
          [
            h.userId,
            h.movieId,
            h.progressSeconds,
            h.durationSeconds,
            h.progressPercent,
            h.lastSeason,
            h.lastEpisode,
            h.updatedAt,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
