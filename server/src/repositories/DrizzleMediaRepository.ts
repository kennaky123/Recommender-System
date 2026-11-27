import { and, asc, desc, eq, ne, SQL, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  drizzleSchema,
  movies,
  ratings,
  UserRow,
  users,
  userWatchlist,
  watchHistory,
} from '../db/drizzleSchema';
import { toNumber, toOptionalNumber } from '../db/numeric';
import { SEED_USERS } from '../db/seedData';
import { MediaEntity } from '../domain/MediaEntity';
import { MediaFactory } from '../domain/MediaFactory';
import {
  AuthUserRecord,
  CatalogSort,
  MovieDTO,
  normalizeMoodTags,
  normalizeUserRole,
  PaginatedCatalogResult,
  RatingRecord,
  RecommendedMovieDTO,
  SearchPaginatedParams,
  UserProfile,
  WatchProgressRecord,
} from '../domain/types';
import { RatingValue, WatchProgressValue } from '../domain/ValueObjects';
import { DatabaseConnection } from './DatabaseConnection';
import { IMediaRepository } from './IMediaRepository';

/**
 * Drizzle ORM PostgreSQL repository implementing IMediaRepository.
 */
export class DrizzleMediaRepository implements IMediaRepository {
  private readonly db: NodePgDatabase<typeof drizzleSchema>;

  public constructor(dbConnection: DatabaseConnection) {
    this.db = dbConnection.db;
  }

  public getStorageMode(): 'postgres' {
    return 'postgres';
  }

  public async getCatalogCounts(): Promise<{
    movieCount: number;
    ratingCount: number;
  }> {
    const [movieRes, ratingRes] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(movies),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(ratings)
        .innerJoin(users, eq(users.id, ratings.userId))
        .where(
          and(eq(users.isSynthetic, false), ne(ratings.source, 'persona_sim'))
        ),
    ]);
    return {
      movieCount: toNumber(movieRes[0]?.count, 0),
      ratingCount: toNumber(ratingRes[0]?.count, 0),
    };
  }

  public async getAllMedia(): Promise<MediaEntity[]> {
    const rows = await this.db.select().from(movies).orderBy(asc(movies.id));
    return rows.map((row) => MediaFactory.fromDrizzleRow(row));
  }

  public async getMediaById(id: number): Promise<MediaEntity | null> {
    const rows = await this.db
      .select()
      .from(movies)
      .where(eq(movies.id, id))
      .limit(1);
    return rows.length > 0 ? MediaFactory.fromDrizzleRow(rows[0]) : null;
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

    const conditions: SQL[] = [];

    if (query) {
      const pattern = `%${query}%`;
      conditions.push(
        sql`(m.title ILIKE ${pattern} OR m.synopsis ILIKE ${pattern} OR m.provider ILIKE ${pattern} OR EXISTS (SELECT 1 FROM unnest(m.genres) g WHERE g ILIKE ${pattern}) OR EXISTS (SELECT 1 FROM unnest(m.tags) t WHERE t ILIKE ${pattern}))`
      );
    }
    if (mood) {
      conditions.push(sql`${mood} = ANY(m.moods)`);
    }
    if (genre) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM unnest(m.genres) g WHERE UPPER(g) = ${genre})`
      );
    }
    if (mediaType) {
      conditions.push(sql`m.media_type = ${mediaType}`);
    }

    const whereClause =
      conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql.empty();

    const countResult = await this.db.execute(
      sql`SELECT COUNT(*)::int AS total FROM movies m ${whereClause}`
    );
    const countRows = countResult.rows as Array<{ total?: number | string }>;
    const total = toNumber(countRows[0]?.total, 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const orderByClause =
      sort === 'newest'
        ? sql`m.release_year DESC NULLS LAST, m.id ASC`
        : sort === 'title'
        ? sql`m.title ASC, m.id ASC`
        : sql`(CASE WHEN m.id <= 16 THEN 1 ELSE 0 END) DESC, COALESCE(rs.rating_count, 0) DESC, m.id ASC`;

    const queryResult =
      sort === 'popular'
        ? await this.db.execute(sql`
          WITH filtered AS (
            SELECT m.* FROM movies m ${whereClause}
          ),
          rating_stats AS (
            SELECT r.movie_id, ROUND(AVG(r.rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS rating_count
            FROM ratings r
            INNER JOIN filtered f ON f.id = r.movie_id
            INNER JOIN users u ON u.id = r.user_id AND u.is_synthetic = FALSE
            WHERE r.source <> 'persona_sim'
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
          LEFT JOIN ratings ur ON ur.movie_id = m.id AND ur.user_id = ${userId}
          LEFT JOIN user_watchlist uw ON uw.movie_id = m.id AND uw.user_id = ${userId}
          LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = ${userId}
          ORDER BY ${orderByClause}
          LIMIT ${limit} OFFSET ${offset}
        `)
        : await this.db.execute(sql`
          WITH paged AS (
            SELECT m.* FROM movies m ${whereClause}
            ORDER BY ${orderByClause}
            LIMIT ${limit} OFFSET ${offset}
          ),
          rating_stats AS (
            SELECT r.movie_id, ROUND(AVG(r.rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS rating_count
            FROM ratings r
            INNER JOIN paged p ON p.id = r.movie_id
            INNER JOIN users u ON u.id = r.user_id AND u.is_synthetic = FALSE
            WHERE r.source <> 'persona_sim'
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
          LEFT JOIN ratings ur ON ur.movie_id = m.id AND ur.user_id = ${userId}
          LEFT JOIN user_watchlist uw ON uw.movie_id = m.id AND uw.user_id = ${userId}
          LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = ${userId}
          ORDER BY ${orderByClause}
        `);

    const rows = queryResult.rows as Record<string, unknown>[];
    const items: RecommendedMovieDTO[] = rows.map((row) => {
      const entity = MediaFactory.fromDatabaseRow(row);
      const avg = toNumber(row.avg_rating, 4.0);
      const cnt = toNumber(row.rating_count, 0);
      const score = Math.round(Math.min(99, Math.max(75, 68 + (avg / 5) * 28)));
      return {
        ...entity.toDTO(),
        matchScore: score,
        matchReason:
          cnt > 0
            ? `${avg.toFixed(1)}★ (${cnt} MOVIELENS RATINGS)`
            : `TMDB #${entity.tmdbId} CATALOG`,
        userRating: toOptionalNumber(row.user_rating),
        inMyList: Boolean(row.in_my_list),
        progressPercent: toOptionalNumber(row.progress_percent),
        lastSeason: toOptionalNumber(row.last_season),
        lastEpisode: toOptionalNumber(row.last_episode),
        communityRating: avg,
        ratingCount: cnt,
      };
    });

    return { items, total, page, totalPages };
  }

  public async upsertExternalMedia(
    dto: Omit<MovieDTO, 'id'>
  ): Promise<MediaEntity> {
    const existing = await this.db
      .select()
      .from(movies)
      .where(
        and(eq(movies.tmdbId, dto.tmdbId), eq(movies.mediaType, dto.mediaType))
      )
      .limit(1);

    if (existing.length > 0) {
      return MediaFactory.fromDrizzleRow(existing[0]);
    }

    const inserted = await this.db
      .insert(movies)
      .values({
        movielensId: dto.movielensId ?? null,
        tmdbId: dto.tmdbId,
        imdbId: dto.imdbId ?? null,
        mediaType: dto.mediaType,
        title: dto.title,
        provider: dto.provider,
        releaseYear: dto.year,
        runtimeMinutes: dto.runtimeMinutes,
        ageRating: dto.ageRating,
        resolution: dto.resolution,
        genres: dto.genres,
        tags: dto.tags,
        moods: dto.moods,
        synopsis: dto.synopsis,
        backdropUrl: dto.backdropUrl,
        trailerYoutubeId: dto.trailerYoutubeId ?? null,
        seasonsCount: dto.seasonsCount ?? 1,
        episodes: dto.episodes ?? [],
      })
      .returning();

    return MediaFactory.fromDrizzleRow(inserted[0]);
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
    const patch: Partial<typeof movies.$inferInsert> = {};
    if (fields.backdropUrl !== undefined) patch.backdropUrl = fields.backdropUrl;
    if (fields.synopsis !== undefined) patch.synopsis = fields.synopsis;
    if (fields.runtimeMinutes !== undefined)
      patch.runtimeMinutes = fields.runtimeMinutes;
    if (fields.trailerYoutubeId !== undefined)
      patch.trailerYoutubeId = fields.trailerYoutubeId;
    if (fields.seasonsCount !== undefined) patch.seasonsCount = fields.seasonsCount;

    if (Object.keys(patch).length === 0) return;

    await this.db.update(movies).set(patch).where(eq(movies.id, id));
  }

  public async getAllRatings(): Promise<RatingRecord[]> {
    const rows = await this.db
      .select({
        userId: ratings.userId,
        movieId: ratings.movieId,
        rating: ratings.rating,
        ratedAt: ratings.ratedAt,
      })
      .from(ratings)
      .innerJoin(users, eq(users.id, ratings.userId))
      .where(
        and(eq(users.isSynthetic, false), ne(ratings.source, 'persona_sim'))
      );

    return rows.map((r) => ({
      userId: r.userId,
      movieId: r.movieId,
      rating: toNumber(r.rating),
      ratedAt: (r.ratedAt ?? new Date()).toISOString(),
    }));
  }

  public async getUserRatings(userId: number): Promise<RatingRecord[]> {
    const rows = await this.db
      .select({
        userId: ratings.userId,
        movieId: ratings.movieId,
        rating: ratings.rating,
        ratedAt: ratings.ratedAt,
      })
      .from(ratings)
      .where(eq(ratings.userId, userId))
      .orderBy(desc(ratings.ratedAt));

    return rows.map((r) => ({
      userId: r.userId,
      movieId: r.movieId,
      rating: toNumber(r.rating),
      ratedAt: (r.ratedAt ?? new Date()).toISOString(),
    }));
  }

  public async upsertRating(
    userId: number,
    movieId: number,
    rating: number
  ): Promise<void> {
    const normalized = RatingValue.create(rating);
    const now = new Date();
    await this.db
      .insert(ratings)
      .values({
        userId,
        movieId,
        rating: String(normalized.value),
        ratedAt: now,
        source: 'explicit_ui',
      })
      .onConflictDoUpdate({
        target: [ratings.userId, ratings.movieId],
        set: {
          rating: String(normalized.value),
          ratedAt: now,
          source: 'explicit_ui',
        },
      });
  }

  public async getWatchlist(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ movieId: userWatchlist.movieId })
      .from(userWatchlist)
      .where(eq(userWatchlist.userId, userId))
      .orderBy(desc(userWatchlist.addedAt));

    return rows.map((r) => r.movieId);
  }

  public async toggleWatchlist(userId: number, movieId: number): Promise<boolean> {
    const existing = await this.db
      .select({ movieId: userWatchlist.movieId })
      .from(userWatchlist)
      .where(
        and(
          eq(userWatchlist.userId, userId),
          eq(userWatchlist.movieId, movieId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .delete(userWatchlist)
        .where(
          and(
            eq(userWatchlist.userId, userId),
            eq(userWatchlist.movieId, movieId)
          )
        );
      return false;
    }

    await this.db
      .insert(userWatchlist)
      .values({ userId, movieId })
      .onConflictDoNothing();
    return true;
  }

  public async getWatchHistory(userId: number): Promise<WatchProgressRecord[]> {
    const rows = await this.db
      .select()
      .from(watchHistory)
      .where(eq(watchHistory.userId, userId))
      .orderBy(desc(watchHistory.updatedAt));

    return rows.map((r) => ({
      userId: r.userId,
      movieId: r.movieId,
      progressSeconds: r.progressSeconds ?? 0,
      durationSeconds: r.durationSeconds ?? 0,
      progressPercent: toNumber(r.progressPercent, 0),
      lastSeason: r.lastSeason ?? 1,
      lastEpisode: r.lastEpisode ?? 1,
      updatedAt: (r.updatedAt ?? new Date()).toISOString(),
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
    const progress = WatchProgressValue.create(progressSeconds, durationSeconds);
    const now = new Date();
    const inserted = await this.db
      .insert(watchHistory)
      .values({
        userId,
        movieId,
        progressSeconds: progress.progressSeconds,
        durationSeconds: progress.durationSeconds,
        progressPercent: String(progress.progressPercent),
        lastSeason: season,
        lastEpisode: episode,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [watchHistory.userId, watchHistory.movieId],
        set: {
          progressSeconds: progress.progressSeconds,
          durationSeconds: progress.durationSeconds,
          progressPercent: String(progress.progressPercent),
          lastSeason: season,
          lastEpisode: episode,
          updatedAt: now,
        },
      })
      .returning();

    const r = inserted[0];
    return {
      userId: r.userId,
      movieId: r.movieId,
      progressSeconds: r.progressSeconds ?? 0,
      durationSeconds: r.durationSeconds ?? 0,
      progressPercent: toNumber(r.progressPercent, 0),
      lastSeason: r.lastSeason ?? 1,
      lastEpisode: r.lastEpisode ?? 1,
      updatedAt: (r.updatedAt ?? now).toISOString(),
    };
  }

  public async getUserProfile(userId: number): Promise<UserProfile> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
        onboardingCompleted: users.onboardingCompleted,
        preferredGenres: users.preferredGenres,
        preferredMoods: users.preferredMoods,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (rows.length > 0) {
      return {
        id: rows[0].id,
        name: rows[0].name,
        email: rows[0].email ?? null,
        avatarUrl: rows[0].avatarUrl || '/backdrops/claude-patterson.jpg',
        role: normalizeUserRole(rows[0].role),
        onboardingCompleted: Boolean(rows[0].onboardingCompleted),
        preferredGenres: [...(rows[0].preferredGenres ?? [])],
        preferredMoods: normalizeMoodTags(rows[0].preferredMoods),
      };
    }
    const fallback = SEED_USERS[0];
    return {
      ...fallback,
      preferredGenres: [...fallback.preferredGenres],
      preferredMoods: [...fallback.preferredMoods],
    };
  }

  private mapAuthRow(row: UserRow): AuthUserRecord {
    return {
      id: row.id,
      name: row.name,
      email: row.email || '',
      passwordHash: row.passwordHash || '',
      avatarUrl: row.avatarUrl || '/backdrops/claude-patterson.jpg',
      role: normalizeUserRole(row.role),
      onboardingCompleted: Boolean(row.onboardingCompleted),
      preferredGenres: [...(row.preferredGenres ?? [])],
      preferredMoods: normalizeMoodTags(row.preferredMoods),
    };
  }

  public async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`)
      .limit(1);
    return rows.length > 0 ? this.mapAuthRow(rows[0]) : null;
  }

  public async findUserById(id: number): Promise<AuthUserRecord | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows.length > 0 ? this.mapAuthRow(rows[0]) : null;
  }

  public async createAuthUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    avatarUrl: string;
  }): Promise<AuthUserRecord> {
    const inserted = await this.db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        avatarUrl: input.avatarUrl,
        role: 'user',
        onboardingCompleted: false,
        preferredGenres: [],
        preferredMoods: [],
      })
      .returning();

    return this.mapAuthRow(inserted[0]);
  }
}
