import { Pool } from 'pg';
import { SEED_USERS } from '../db/seedData';
import { MediaEntity } from '../domain/MediaEntity';
import { MediaFactory } from '../domain/MediaFactory';
import {
  CatalogSort,
  MovieDTO,
  PaginatedCatalogResult,
  RatingRecord,
  RecommendedMovieDTO,
  SearchPaginatedParams,
  UserProfile,
  WatchProgressRecord,
} from '../domain/types';
import { DatabaseConnection } from './DatabaseConnection';
import { IMediaRepository } from './IMediaRepository';

/**
 * PostgreSQL-backed concrete repository implementing IMediaRepository.
 */
export class PostgresMediaRepository implements IMediaRepository {
  private readonly pool: Pool;

  public constructor(dbConnection: DatabaseConnection) {
    this.pool = dbConnection.pool;
  }

  public getStorageMode(): 'postgres' {
    return 'postgres';
  }

  public async getCatalogCounts(): Promise<{
    movieCount: number;
    ratingCount: number;
  }> {
    const { rows } = await this.pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM movies) AS movie_count,
        (SELECT COUNT(*)::int FROM ratings) AS rating_count`
    );
    return {
      movieCount: Number(rows[0]?.movie_count ?? 0),
      ratingCount: Number(rows[0]?.rating_count ?? 0),
    };
  }

  public async getAllMedia(): Promise<MediaEntity[]> {
    const { rows } = await this.pool.query('SELECT * FROM movies ORDER BY id ASC');
    return rows.map((r) => MediaFactory.fromDatabaseRow(r));
  }

  public async getMediaById(id: number): Promise<MediaEntity | null> {
    const { rows } = await this.pool.query('SELECT * FROM movies WHERE id = $1', [
      id,
    ]);
    return rows.length > 0 ? MediaFactory.fromDatabaseRow(rows[0]) : null;
  }

  public async searchPaginated(
    params: SearchPaginatedParams
  ): Promise<PaginatedCatalogResult> {
    const userId = params.userId ?? 1;
    const query = (params.query ?? '').trim();
    const mood = params.mood && params.mood !== 'all' ? params.mood : null;
    const genre =
      params.genre && params.genre.toUpperCase() !== 'ALL'
        ? params.genre.toUpperCase()
        : null;
    const mediaType =
      params.mediaType && params.mediaType !== 'all' ? params.mediaType : null;
    const sort: CatalogSort = params.sort ?? 'popular';
    const limit = Math.max(1, Math.min(60, params.limit ?? 24));
    const page = Math.max(1, params.page ?? 1);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (query) {
      values.push(`%${query}%`);
      const p = `$${values.length}`;
      conditions.push(
        `(m.title ILIKE ${p} OR m.synopsis ILIKE ${p} OR m.provider ILIKE ${p} OR EXISTS (SELECT 1 FROM unnest(m.genres) g WHERE g ILIKE ${p}) OR EXISTS (SELECT 1 FROM unnest(m.tags) t WHERE t ILIKE ${p}))`
      );
    }
    if (mood) {
      values.push(mood);
      conditions.push(`$${values.length} = ANY(m.moods)`);
    }
    if (genre) {
      values.push(genre);
      conditions.push(
        `EXISTS (SELECT 1 FROM unnest(m.genres) g WHERE UPPER(g) = $${values.length})`
      );
    }
    if (mediaType) {
      values.push(mediaType);
      conditions.push(`m.media_type = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM movies m ${whereClause}`,
      values
    );
    const total = Number(countRes.rows[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const orderBy =
      sort === 'newest'
        ? 'm.release_year DESC NULLS LAST, m.id ASC'
        : sort === 'title'
        ? 'm.title ASC, m.id ASC'
        : '(CASE WHEN m.id <= 16 THEN 1 ELSE 0 END) DESC, COALESCE(rs.rating_count, 0) DESC, m.id ASC';

    const queryValues = [...values, userId, limit, offset];
    const uidParam = `$${values.length + 1}`;
    const limitParam = `$${values.length + 2}`;
    const offsetParam = `$${values.length + 3}`;

    const sql =
      sort === 'popular'
        ? `
      WITH filtered AS (
        SELECT m.* FROM movies m ${whereClause}
      ),
      rating_stats AS (
        SELECT r.movie_id, ROUND(AVG(r.rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS rating_count
        FROM ratings r
        INNER JOIN filtered f ON f.id = r.movie_id
        GROUP BY r.movie_id
      )
      SELECT
        m.*,
        COALESCE(rs.avg_rating, 4.0)::float AS avg_rating,
        COALESCE(rs.rating_count, 0)::int AS rating_count,
        ur.rating::float AS user_rating,
        (uw.movie_id IS NOT NULL) AS in_my_list,
        wh.progress_percent::float AS progress_percent,
        wh.last_season,
        wh.last_episode
      FROM filtered m
      LEFT JOIN rating_stats rs ON rs.movie_id = m.id
      LEFT JOIN ratings ur ON ur.movie_id = m.id AND ur.user_id = ${uidParam}
      LEFT JOIN user_watchlist uw ON uw.movie_id = m.id AND uw.user_id = ${uidParam}
      LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = ${uidParam}
      ORDER BY ${orderBy}
      LIMIT ${limitParam} OFFSET ${offsetParam}`
        : `
      WITH paged AS (
        SELECT m.* FROM movies m ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${limitParam} OFFSET ${offsetParam}
      ),
      rating_stats AS (
        SELECT r.movie_id, ROUND(AVG(r.rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS rating_count
        FROM ratings r
        INNER JOIN paged p ON p.id = r.movie_id
        GROUP BY r.movie_id
      )
      SELECT
        m.*,
        COALESCE(rs.avg_rating, 4.0)::float AS avg_rating,
        COALESCE(rs.rating_count, 0)::int AS rating_count,
        ur.rating::float AS user_rating,
        (uw.movie_id IS NOT NULL) AS in_my_list,
        wh.progress_percent::float AS progress_percent,
        wh.last_season,
        wh.last_episode
      FROM paged m
      LEFT JOIN rating_stats rs ON rs.movie_id = m.id
      LEFT JOIN ratings ur ON ur.movie_id = m.id AND ur.user_id = ${uidParam}
      LEFT JOIN user_watchlist uw ON uw.movie_id = m.id AND uw.user_id = ${uidParam}
      LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = ${uidParam}
      ORDER BY ${orderBy}`;

    const { rows } = await this.pool.query(sql, queryValues);
    const items: RecommendedMovieDTO[] = rows.map((row) => {
      const entity = MediaFactory.fromDatabaseRow(row);
      const avg = Number(row.avg_rating ?? 4.0);
      const cnt = Number(row.rating_count ?? 0);
      const score = Math.round(Math.min(99, Math.max(75, 68 + (avg / 5) * 28)));
      return {
        ...entity.toDTO(),
        matchScore: score,
        matchReason:
          cnt > 0
            ? `${avg.toFixed(1)}★ (${cnt} MOVIELENS RATINGS)`
            : `TMDB #${entity.tmdbId} CATALOG`,
        userRating:
          row.user_rating !== null && row.user_rating !== undefined
            ? Number(row.user_rating)
            : undefined,
        inMyList: Boolean(row.in_my_list),
        progressPercent:
          row.progress_percent !== null && row.progress_percent !== undefined
            ? Number(row.progress_percent)
            : undefined,
        lastSeason: row.last_season ? Number(row.last_season) : undefined,
        lastEpisode: row.last_episode ? Number(row.last_episode) : undefined,
        communityRating: avg,
        ratingCount: cnt,
      };
    });

    return { items, total, page, totalPages };
  }

  public async upsertExternalMedia(dto: Omit<MovieDTO, 'id'>): Promise<MediaEntity> {
    const existing = await this.pool.query(
      'SELECT * FROM movies WHERE tmdb_id = $1 AND media_type = $2 LIMIT 1',
      [dto.tmdbId, dto.mediaType]
    );
    if (existing.rows.length > 0) {
      return MediaFactory.fromDatabaseRow(existing.rows[0]);
    }

    const { rows } = await this.pool.query(
      `INSERT INTO movies (
        movielens_id, tmdb_id, imdb_id, media_type, title, provider,
        release_year, runtime_minutes, age_rating, resolution, genres, tags, moods,
        synopsis, backdrop_url, trailer_youtube_id, seasons_count, episodes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
      RETURNING *`,
      [
        dto.movielensId ?? null,
        dto.tmdbId,
        dto.imdbId ?? null,
        dto.mediaType,
        dto.title,
        dto.provider,
        dto.year,
        dto.runtimeMinutes,
        dto.ageRating,
        dto.resolution,
        dto.genres,
        dto.tags,
        dto.moods,
        dto.synopsis,
        dto.backdropUrl,
        dto.trailerYoutubeId ?? null,
        dto.seasonsCount ?? 1,
        JSON.stringify(dto.episodes ?? []),
      ]
    );
    return MediaFactory.fromDatabaseRow(rows[0]);
  }

  public async updateMediaEnrichment(
    id: number,
    fields: Partial<
      Pick<
        MovieDTO,
        | 'backdropUrl'
        | 'synopsis'
        | 'runtimeMinutes'
        | 'trailerYoutubeId'
        | 'seasonsCount'
      >
    >
  ): Promise<void> {
    await this.pool.query(
      `UPDATE movies SET
        backdrop_url = COALESCE($2, backdrop_url),
        synopsis = COALESCE($3, synopsis),
        runtime_minutes = COALESCE($4, runtime_minutes),
        trailer_youtube_id = COALESCE($5, trailer_youtube_id),
        seasons_count = COALESCE($6, seasons_count)
      WHERE id = $1`,
      [
        id,
        fields.backdropUrl ?? null,
        fields.synopsis ?? null,
        fields.runtimeMinutes ?? null,
        fields.trailerYoutubeId ?? null,
        fields.seasonsCount ?? null,
      ]
    );
  }

  public async getAllRatings(): Promise<RatingRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT user_id, movie_id, rating, rated_at FROM ratings'
    );
    return rows.map((r) => ({
      userId: Number(r.user_id),
      movieId: Number(r.movie_id),
      rating: Number(r.rating),
      ratedAt: new Date(r.rated_at).toISOString(),
    }));
  }

  public async getUserRatings(userId: number): Promise<RatingRecord[]> {
    const { rows } = await this.pool.query(
      'SELECT user_id, movie_id, rating, rated_at FROM ratings WHERE user_id = $1 ORDER BY rated_at DESC',
      [userId]
    );
    return rows.map((r) => ({
      userId: Number(r.user_id),
      movieId: Number(r.movie_id),
      rating: Number(r.rating),
      ratedAt: new Date(r.rated_at).toISOString(),
    }));
  }

  public async upsertRating(
    userId: number,
    movieId: number,
    rating: number
  ): Promise<void> {
    const clamped = Math.max(0.5, Math.min(5.0, Math.round(rating * 2) / 2));
    await this.pool.query(
      `INSERT INTO ratings (user_id, movie_id, rating, rated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, movie_id)
       DO UPDATE SET rating = EXCLUDED.rating, rated_at = NOW()`,
      [userId, movieId, clamped]
    );
  }

  public async getWatchlist(userId: number): Promise<number[]> {
    const { rows } = await this.pool.query(
      'SELECT movie_id FROM user_watchlist WHERE user_id = $1 ORDER BY added_at DESC',
      [userId]
    );
    return rows.map((r) => Number(r.movie_id));
  }

  public async toggleWatchlist(userId: number, movieId: number): Promise<boolean> {
    const existing = await this.pool.query(
      'SELECT 1 FROM user_watchlist WHERE user_id = $1 AND movie_id = $2',
      [userId, movieId]
    );
    if (existing.rows.length > 0) {
      await this.pool.query(
        'DELETE FROM user_watchlist WHERE user_id = $1 AND movie_id = $2',
        [userId, movieId]
      );
      return false;
    }
    await this.pool.query(
      'INSERT INTO user_watchlist (user_id, movie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, movieId]
    );
    return true;
  }

  public async getWatchHistory(userId: number): Promise<WatchProgressRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT user_id, movie_id, progress_seconds, duration_seconds, progress_percent,
              last_season, last_episode, updated_at
       FROM watch_history WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      userId: Number(r.user_id),
      movieId: Number(r.movie_id),
      progressSeconds: Number(r.progress_seconds),
      durationSeconds: Number(r.duration_seconds),
      progressPercent: Number(r.progress_percent),
      lastSeason: Number(r.last_season || 1),
      lastEpisode: Number(r.last_episode || 1),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  public async upsertWatchProgress(
    userId: number,
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season = 1,
    episode = 1
  ): Promise<WatchProgressRecord> {
    const safeDuration = Math.max(1, Math.round(durationSeconds));
    const safeProgress = Math.max(
      0,
      Math.min(safeDuration, Math.round(progressSeconds))
    );
    const pct = Number(Math.min(100, (safeProgress / safeDuration) * 100).toFixed(2));
    const { rows } = await this.pool.query(
      `INSERT INTO watch_history (
        user_id, movie_id, progress_seconds, duration_seconds, progress_percent,
        last_season, last_episode, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id, movie_id)
      DO UPDATE SET
        progress_seconds = EXCLUDED.progress_seconds,
        duration_seconds = EXCLUDED.duration_seconds,
        progress_percent = EXCLUDED.progress_percent,
        last_season = EXCLUDED.last_season,
        last_episode = EXCLUDED.last_episode,
        updated_at = NOW()
      RETURNING *`,
      [userId, movieId, safeProgress, safeDuration, pct, season, episode]
    );
    const r = rows[0];
    return {
      userId: Number(r.user_id),
      movieId: Number(r.movie_id),
      progressSeconds: Number(r.progress_seconds),
      durationSeconds: Number(r.duration_seconds),
      progressPercent: Number(r.progress_percent),
      lastSeason: Number(r.last_season || 1),
      lastEpisode: Number(r.last_episode || 1),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }

  public async getUserProfile(userId: number): Promise<UserProfile> {
    const { rows } = await this.pool.query(
      'SELECT id, name, avatar_url FROM users WHERE id = $1',
      [userId]
    );
    if (rows.length > 0) {
      return {
        id: Number(rows[0].id),
        name: String(rows[0].name),
        avatarUrl: String(
          rows[0].avatar_url || '/backdrops/claude-patterson.jpg'
        ),
      };
    }
    return SEED_USERS[0];
  }
}
