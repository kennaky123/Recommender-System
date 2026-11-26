import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import {
  SEED_MOVIES,
  SEED_RATINGS,
  SEED_USERS,
  SEED_WATCHLIST,
  SEED_WATCH_HISTORY,
} from './seedData';
import {
  CatalogSort,
  MoodTag,
  Movie,
  RatingRecord,
  RecommendedMovie,
  UserProfile,
  WatchProgressRecord,
} from '../types';

export interface SearchPaginatedParams {
  userId?: number;
  query?: string;
  mood?: MoodTag;
  genre?: string;
  mediaType?: 'all' | 'movie' | 'tv';
  sort?: CatalogSort;
  page?: number;
  limit?: number;
}

export interface DataStore {
  getStorageMode(): 'postgres' | 'memory-fallback';
  getCatalogCounts(): Promise<{ movieCount: number; ratingCount: number }>;
  getMovies(): Promise<Movie[]>;
  getMovieById(id: number): Promise<Movie | null>;
  searchMovies(query: string, mood?: MoodTag, genre?: string): Promise<Movie[]>;
  searchMoviesPaginated(params: SearchPaginatedParams): Promise<{
    items: RecommendedMovie[];
    total: number;
    page: number;
    totalPages: number;
  }>;
  upsertExternalMovie(movie: Omit<Movie, 'id'>): Promise<Movie>;
  updateMovieEnrichment(
    id: number,
    fields: Partial<
      Pick<Movie, 'backdropUrl' | 'synopsis' | 'runtimeMinutes' | 'trailerYoutubeId' | 'seasonsCount'>
    >
  ): Promise<void>;
  getAllRatings(): Promise<RatingRecord[]>;
  getUserRatings(userId: number): Promise<RatingRecord[]>;
  upsertRating(userId: number, movieId: number, rating: number): Promise<void>;
  getWatchlist(userId: number): Promise<number[]>;
  toggleWatchlist(userId: number, movieId: number): Promise<boolean>;
  getWatchHistory(userId: number): Promise<WatchProgressRecord[]>;
  upsertWatchProgress(
    userId: number,
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season?: number,
    episode?: number
  ): Promise<WatchProgressRecord>;
  getUserProfile(userId: number): Promise<UserProfile>;
}

function mapMovieRow(row: Record<string, unknown>): Movie {
  const movielensId =
    row.movielens_id !== null && row.movielens_id !== undefined
      ? Number(row.movielens_id)
      : null;
  return {
    id: Number(row.id),
    movielensId,
    tmdbId: Number(row.tmdb_id),
    imdbId: (row.imdb_id as string | null) ?? null,
    mediaType: (row.media_type as Movie['mediaType']) || 'movie',
    title: String(row.title),
    provider: (row.provider as Movie['provider']) || 'NETFLIX',
    year: Number(row.release_year || 2021),
    runtimeMinutes: Number(row.runtime_minutes || 110),
    ageRating: String(row.age_rating || '15'),
    resolution: (row.resolution as Movie['resolution']) || '8K',
    genres: Array.isArray(row.genres) ? (row.genres as string[]) : [],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    moods: Array.isArray(row.moods) ? (row.moods as MoodTag[]) : [],
    synopsis: String(row.synopsis || ''),
    backdropUrl: String(row.backdrop_url || '/backdrops/interstellar.jpg'),
    trailerYoutubeId: (row.trailer_youtube_id as string | null) ?? null,
    seasonsCount: row.seasons_count ? Number(row.seasons_count) : 1,
    episodes: Array.isArray(row.episodes) ? (row.episodes as Movie['episodes']) : [],
    source: movielensId ? 'movielens' : 'local',
  };
}

export async function seedPostgresDefaults(): Promise<void> {
  const client = await pool.connect();
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

class PostgresStore implements DataStore {
  getStorageMode(): 'postgres' {
    return 'postgres';
  }

  async getCatalogCounts(): Promise<{ movieCount: number; ratingCount: number }> {
    const { rows } = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM movies) AS movie_count,
        (SELECT COUNT(*)::int FROM ratings) AS rating_count`
    );
    return {
      movieCount: Number(rows[0]?.movie_count ?? 0),
      ratingCount: Number(rows[0]?.rating_count ?? 0),
    };
  }

  async getMovies(): Promise<Movie[]> {
    const { rows } = await pool.query('SELECT * FROM movies ORDER BY id ASC');
    return rows.map(mapMovieRow);
  }

  async getMovieById(id: number): Promise<Movie | null> {
    const { rows } = await pool.query('SELECT * FROM movies WHERE id = $1', [id]);
    return rows.length > 0 ? mapMovieRow(rows[0]) : null;
  }

  async searchMovies(query: string, mood?: MoodTag, genre?: string): Promise<Movie[]> {
    const res = await this.searchMoviesPaginated({
      query,
      mood,
      genre,
      page: 1,
      limit: 48,
    });
    return res.items;
  }

  async searchMoviesPaginated(params: SearchPaginatedParams): Promise<{
    items: RecommendedMovie[];
    total: number;
    page: number;
    totalPages: number;
  }> {
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

    const countRes = await pool.query(
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

    const { rows } = await pool.query(sql, queryValues);
    const items: RecommendedMovie[] = rows.map((row) => {
      const movie = mapMovieRow(row);
      const avg = Number(row.avg_rating ?? 4.0);
      const cnt = Number(row.rating_count ?? 0);
      const score = Math.round(Math.min(99, Math.max(75, 68 + (avg / 5) * 28)));
      return {
        ...movie,
        matchScore: score,
        matchReason:
          cnt > 0
            ? `${avg.toFixed(1)}★ (${cnt} MOVIELENS RATINGS)`
            : `TMDB #${movie.tmdbId} CATALOG`,
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

  async upsertExternalMovie(movie: Omit<Movie, 'id'>): Promise<Movie> {
    const existing = await pool.query(
      'SELECT * FROM movies WHERE tmdb_id = $1 AND media_type = $2 LIMIT 1',
      [movie.tmdbId, movie.mediaType]
    );
    if (existing.rows.length > 0) {
      return mapMovieRow(existing.rows[0]);
    }

    const { rows } = await pool.query(
      `INSERT INTO movies (
        movielens_id, tmdb_id, imdb_id, media_type, title, provider,
        release_year, runtime_minutes, age_rating, resolution, genres, tags, moods,
        synopsis, backdrop_url, trailer_youtube_id, seasons_count, episodes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
      RETURNING *`,
      [
        movie.movielensId ?? null,
        movie.tmdbId,
        movie.imdbId ?? null,
        movie.mediaType,
        movie.title,
        movie.provider,
        movie.year,
        movie.runtimeMinutes,
        movie.ageRating,
        movie.resolution,
        movie.genres,
        movie.tags,
        movie.moods,
        movie.synopsis,
        movie.backdropUrl,
        movie.trailerYoutubeId ?? null,
        movie.seasonsCount ?? 1,
        JSON.stringify(movie.episodes ?? []),
      ]
    );
    return mapMovieRow(rows[0]);
  }

  async updateMovieEnrichment(
    id: number,
    fields: Partial<
      Pick<Movie, 'backdropUrl' | 'synopsis' | 'runtimeMinutes' | 'trailerYoutubeId' | 'seasonsCount'>
    >
  ): Promise<void> {
    await pool.query(
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

  async getAllRatings(): Promise<RatingRecord[]> {
    const { rows } = await pool.query(
      'SELECT user_id, movie_id, rating, rated_at FROM ratings'
    );
    return rows.map((r) => ({
      userId: Number(r.user_id),
      movieId: Number(r.movie_id),
      rating: Number(r.rating),
      ratedAt: new Date(r.rated_at).toISOString(),
    }));
  }

  async getUserRatings(userId: number): Promise<RatingRecord[]> {
    const { rows } = await pool.query(
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

  async upsertRating(userId: number, movieId: number, rating: number): Promise<void> {
    const clamped = Math.max(0.5, Math.min(5.0, Math.round(rating * 2) / 2));
    await pool.query(
      `INSERT INTO ratings (user_id, movie_id, rating, rated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, movie_id)
       DO UPDATE SET rating = EXCLUDED.rating, rated_at = NOW()`,
      [userId, movieId, clamped]
    );
  }

  async getWatchlist(userId: number): Promise<number[]> {
    const { rows } = await pool.query(
      'SELECT movie_id FROM user_watchlist WHERE user_id = $1 ORDER BY added_at DESC',
      [userId]
    );
    return rows.map((r) => Number(r.movie_id));
  }

  async toggleWatchlist(userId: number, movieId: number): Promise<boolean> {
    const existing = await pool.query(
      'SELECT 1 FROM user_watchlist WHERE user_id = $1 AND movie_id = $2',
      [userId, movieId]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        'DELETE FROM user_watchlist WHERE user_id = $1 AND movie_id = $2',
        [userId, movieId]
      );
      return false;
    }
    await pool.query(
      'INSERT INTO user_watchlist (user_id, movie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, movieId]
    );
    return true;
  }

  async getWatchHistory(userId: number): Promise<WatchProgressRecord[]> {
    const { rows } = await pool.query(
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

  async upsertWatchProgress(
    userId: number,
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season = 1,
    episode = 1
  ): Promise<WatchProgressRecord> {
    const safeDuration = Math.max(1, Math.round(durationSeconds));
    const safeProgress = Math.max(0, Math.min(safeDuration, Math.round(progressSeconds)));
    const pct = Number(Math.min(100, (safeProgress / safeDuration) * 100).toFixed(2));
    const { rows } = await pool.query(
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

  async getUserProfile(userId: number): Promise<UserProfile> {
    const { rows } = await pool.query(
      'SELECT id, name, avatar_url FROM users WHERE id = $1',
      [userId]
    );
    if (rows.length > 0) {
      return {
        id: Number(rows[0].id),
        name: String(rows[0].name),
        avatarUrl: String(rows[0].avatar_url || '/backdrops/claude-patterson.jpg'),
      };
    }
    return SEED_USERS[0];
  }
}

class InMemoryFallbackStore implements DataStore {
  private movies: Movie[] = structuredClone(SEED_MOVIES);
  private users: UserProfile[] = structuredClone(SEED_USERS);
  private ratings: RatingRecord[] = structuredClone(SEED_RATINGS);
  private watchlist = new Map<number, number[]>();
  private watchHistory = new Map<number, WatchProgressRecord[]>();

  constructor() {
    for (const w of SEED_WATCHLIST) {
      const list = this.watchlist.get(w.userId) ?? [];
      list.push(w.movieId);
      this.watchlist.set(w.userId, list);
    }
    for (const h of SEED_WATCH_HISTORY) {
      const list = this.watchHistory.get(h.userId) ?? [];
      list.push({ ...h });
      this.watchHistory.set(h.userId, list);
    }
  }

  getStorageMode(): 'memory-fallback' {
    return 'memory-fallback';
  }

  async getCatalogCounts(): Promise<{ movieCount: number; ratingCount: number }> {
    return { movieCount: this.movies.length, ratingCount: this.ratings.length };
  }

  async getMovies(): Promise<Movie[]> {
    return this.movies;
  }

  async getMovieById(id: number): Promise<Movie | null> {
    return this.movies.find((m) => m.id === id) ?? null;
  }

  async searchMovies(query: string, mood?: MoodTag, genre?: string): Promise<Movie[]> {
    const res = await this.searchMoviesPaginated({ query, mood, genre, limit: 48 });
    return res.items;
  }

  async searchMoviesPaginated(params: SearchPaginatedParams): Promise<{
    items: RecommendedMovie[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const userId = params.userId ?? 1;
    const q = (params.query ?? '').trim().toLowerCase();
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

    const filtered = this.movies.filter((m) => {
      const matchesQ =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.synopsis.toLowerCase().includes(q) ||
        m.genres.some((g) => g.toLowerCase().includes(q)) ||
        m.tags.some((t) => t.toLowerCase().includes(q)) ||
        m.provider.toLowerCase().includes(q);
      const matchesMood = !mood || m.moods.includes(mood);
      const matchesGenre = !genre || m.genres.some((g) => g.toUpperCase() === genre);
      const matchesMedia = !mediaType || m.mediaType === mediaType;
      return matchesQ && matchesMood && matchesGenre && matchesMedia;
    });

    const watchlistSet = new Set(this.watchlist.get(userId) ?? []);
    const userRatings = new Map(
      this.ratings.filter((r) => r.userId === userId).map((r) => [r.movieId, r.rating])
    );
    const histMap = new Map(
      (this.watchHistory.get(userId) ?? []).map((h) => [h.movieId, h])
    );

    const enriched: RecommendedMovie[] = filtered.map((m) => {
      const rs = this.ratings.filter((r) => r.movieId === m.id);
      const cnt = rs.length;
      const avg = cnt > 0 ? rs.reduce((s, r) => s + r.rating, 0) / cnt : 4.2;
      const h = histMap.get(m.id);
      return {
        ...m,
        matchScore: Math.round(Math.min(99, 68 + (avg / 5) * 28)),
        matchReason: cnt > 0 ? `${avg.toFixed(1)}★ (${cnt} RATINGS)` : `TMDB #${m.tmdbId}`,
        userRating: userRatings.get(m.id),
        inMyList: watchlistSet.has(m.id),
        progressPercent: h?.progressPercent,
        lastSeason: h?.lastSeason,
        lastEpisode: h?.lastEpisode,
        communityRating: Number(avg.toFixed(2)),
        ratingCount: cnt,
      };
    });

    enriched.sort((a, b) => {
      if (sort === 'newest') return b.year - a.year;
      if (sort === 'title') return a.title.localeCompare(b.title);
      return b.ratingCount - a.ratingCount || a.id - b.id;
    });

    const total = enriched.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return {
      items: enriched.slice(start, start + limit),
      total,
      page,
      totalPages,
    };
  }

  async upsertExternalMovie(movie: Omit<Movie, 'id'>): Promise<Movie> {
    const existing = this.movies.find(
      (m) => m.tmdbId === movie.tmdbId && m.mediaType === movie.mediaType
    );
    if (existing) return existing;
    const nextId = Math.max(0, ...this.movies.map((m) => m.id)) + 1;
    const created: Movie = { ...movie, id: nextId };
    this.movies.push(created);
    return created;
  }

  async updateMovieEnrichment(
    id: number,
    fields: Partial<
      Pick<Movie, 'backdropUrl' | 'synopsis' | 'runtimeMinutes' | 'trailerYoutubeId' | 'seasonsCount'>
    >
  ): Promise<void> {
    const idx = this.movies.findIndex((m) => m.id === id);
    if (idx >= 0) {
      this.movies[idx] = { ...this.movies[idx], ...fields };
    }
  }

  async getAllRatings(): Promise<RatingRecord[]> {
    return this.ratings;
  }

  async getUserRatings(userId: number): Promise<RatingRecord[]> {
    return this.ratings
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.ratedAt.localeCompare(a.ratedAt));
  }

  async upsertRating(userId: number, movieId: number, rating: number): Promise<void> {
    const clamped = Math.max(0.5, Math.min(5.0, Math.round(rating * 2) / 2));
    const now = new Date().toISOString();
    const idx = this.ratings.findIndex((r) => r.userId === userId && r.movieId === movieId);
    if (idx >= 0) {
      this.ratings[idx] = { userId, movieId, rating: clamped, ratedAt: now };
    } else {
      this.ratings.push({ userId, movieId, rating: clamped, ratedAt: now });
    }
  }

  async getWatchlist(userId: number): Promise<number[]> {
    return [...(this.watchlist.get(userId) ?? [])];
  }

  async toggleWatchlist(userId: number, movieId: number): Promise<boolean> {
    const current = this.watchlist.get(userId) ?? [];
    if (current.includes(movieId)) {
      this.watchlist.set(
        userId,
        current.filter((id) => id !== movieId)
      );
      return false;
    }
    this.watchlist.set(userId, [movieId, ...current]);
    return true;
  }

  async getWatchHistory(userId: number): Promise<WatchProgressRecord[]> {
    const list = this.watchHistory.get(userId) ?? [];
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async upsertWatchProgress(
    userId: number,
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season = 1,
    episode = 1
  ): Promise<WatchProgressRecord> {
    const safeDuration = Math.max(1, Math.round(durationSeconds));
    const safeProgress = Math.max(0, Math.min(safeDuration, Math.round(progressSeconds)));
    const pct = Number(Math.min(100, (safeProgress / safeDuration) * 100).toFixed(2));
    const record: WatchProgressRecord = {
      userId,
      movieId,
      progressSeconds: safeProgress,
      durationSeconds: safeDuration,
      progressPercent: pct,
      lastSeason: season,
      lastEpisode: episode,
      updatedAt: new Date().toISOString(),
    };
    const list = this.watchHistory.get(userId) ?? [];
    const idx = list.findIndex((h) => h.movieId === movieId);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    this.watchHistory.set(userId, list);
    return record;
  }

  async getUserProfile(userId: number): Promise<UserProfile> {
    return this.users.find((u) => u.id === userId) ?? this.users[0];
  }
}

let activeStore: DataStore | null = null;

export function resolveSchemaPath(): string {
  const local = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(local)) return local;
  return path.resolve(__dirname, '..', '..', 'src', 'db', 'schema.sql');
}

export async function initDataStore(): Promise<DataStore> {
  if (activeStore) return activeStore;
  try {
    await pool.query('SELECT 1');
    const schemaPath = resolveSchemaPath();
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schemaSql);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM movies');
    if (Number(rows[0]?.cnt ?? 0) === 0) {
      await seedPostgresDefaults();
    }
    console.log('[DB] Connected to PostgreSQL and verified schema.');
    activeStore = new PostgresStore();
    return activeStore;
  } catch (err) {
    console.warn(
      `[DB] PostgreSQL unavailable (${(err as Error).message}). Using InMemoryFallbackStore.`
    );
    activeStore = new InMemoryFallbackStore();
    return activeStore;
  }
}

export function getDataStore(): DataStore {
  if (!activeStore) {
    activeStore = new InMemoryFallbackStore();
  }
  return activeStore;
}
