import {
  SEED_MOVIES,
  SEED_RATINGS,
  SEED_USERS,
  SEED_WATCHLIST,
  SEED_WATCH_HISTORY,
} from '../db/seedData';
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
import { IMediaRepository } from './IMediaRepository';

/**
 * In-memory fallback repository implementing IMediaRepository when PostgreSQL is unavailable.
 */
export class InMemoryMediaRepository implements IMediaRepository {
  private readonly mediaList: MediaEntity[];
  private readonly users: UserProfile[];
  private readonly ratings: RatingRecord[];
  private readonly watchlist = new Map<number, number[]>();
  private readonly watchHistory = new Map<number, WatchProgressRecord[]>();

  public constructor() {
    this.mediaList = SEED_MOVIES.map((dto) =>
      MediaFactory.fromDTO(structuredClone(dto))
    );
    this.users = structuredClone(SEED_USERS);
    this.ratings = structuredClone(SEED_RATINGS);

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

  public getStorageMode(): 'memory-fallback' {
    return 'memory-fallback';
  }

  public async getCatalogCounts(): Promise<{
    movieCount: number;
    ratingCount: number;
  }> {
    return {
      movieCount: this.mediaList.length,
      ratingCount: this.ratings.length,
    };
  }

  public async getAllMedia(): Promise<MediaEntity[]> {
    return [...this.mediaList];
  }

  public async getMediaById(id: number): Promise<MediaEntity | null> {
    return this.mediaList.find((m) => m.id === id) ?? null;
  }

  public async searchPaginated(
    params: SearchPaginatedParams
  ): Promise<PaginatedCatalogResult> {
    const userId = params.userId ?? 1;
    const q = (params.query ?? '').trim().toLowerCase();
    const mood = params.mood ?? 'all';
    const genre = params.genre ?? 'ALL';
    const mediaType = params.mediaType ?? 'all';
    const sort: CatalogSort = params.sort ?? 'popular';
    const limit = Math.max(1, Math.min(60, params.limit ?? 24));
    const page = Math.max(1, params.page ?? 1);

    const filtered = this.mediaList.filter((m) => {
      const matchesQ =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.synopsis.toLowerCase().includes(q) ||
        m.genres.some((g) => g.toLowerCase().includes(q)) ||
        m.tags.some((t) => t.toLowerCase().includes(q)) ||
        m.provider.toLowerCase().includes(q);
      const matchesMood = m.matchesMood(mood);
      const matchesGenre = m.hasGenre(genre);
      const matchesMedia = mediaType === 'all' || m.mediaType === mediaType;
      return matchesQ && matchesMood && matchesGenre && matchesMedia;
    });

    const watchlistSet = new Set(this.watchlist.get(userId) ?? []);
    const userRatings = new Map(
      this.ratings.filter((r) => r.userId === userId).map((r) => [r.movieId, r.rating])
    );
    const histMap = new Map(
      (this.watchHistory.get(userId) ?? []).map((h) => [h.movieId, h])
    );

    const enriched: RecommendedMovieDTO[] = filtered.map((m) => {
      const rs = this.ratings.filter((r) => r.movieId === m.id);
      const cnt = rs.length;
      const avg = cnt > 0 ? rs.reduce((s, r) => s + r.rating, 0) / cnt : 4.2;
      const h = histMap.get(m.id);
      return {
        ...m.toDTO(),
        matchScore: Math.round(Math.min(99, 68 + (avg / 5) * 28)),
        matchReason:
          cnt > 0 ? `${avg.toFixed(1)}★ (${cnt} RATINGS)` : `TMDB #${m.tmdbId}`,
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

  public async upsertExternalMedia(
    dto: Omit<MovieDTO, 'id'>
  ): Promise<MediaEntity> {
    const existing = this.mediaList.find(
      (m) => m.tmdbId === dto.tmdbId && m.mediaType === dto.mediaType
    );
    if (existing) return existing;
    const nextId = Math.max(0, ...this.mediaList.map((m) => m.id)) + 1;
    const created = MediaFactory.fromDTO({ ...dto, id: nextId });
    this.mediaList.push(created);
    return created;
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
    const idx = this.mediaList.findIndex((m) => m.id === id);
    if (idx >= 0) {
      const merged = { ...this.mediaList[idx].toDTO(), ...fields };
      this.mediaList[idx] = MediaFactory.fromDTO(merged);
    }
  }

  public async getAllRatings(): Promise<RatingRecord[]> {
    return [...this.ratings];
  }

  public async getUserRatings(userId: number): Promise<RatingRecord[]> {
    return this.ratings
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.ratedAt.localeCompare(a.ratedAt));
  }

  public async upsertRating(
    userId: number,
    movieId: number,
    rating: number
  ): Promise<void> {
    const clamped = Math.max(0.5, Math.min(5.0, Math.round(rating * 2) / 2));
    const now = new Date().toISOString();
    const idx = this.ratings.findIndex(
      (r) => r.userId === userId && r.movieId === movieId
    );
    if (idx >= 0) {
      this.ratings[idx] = { userId, movieId, rating: clamped, ratedAt: now };
    } else {
      this.ratings.push({ userId, movieId, rating: clamped, ratedAt: now });
    }
  }

  public async getWatchlist(userId: number): Promise<number[]> {
    return [...(this.watchlist.get(userId) ?? [])];
  }

  public async toggleWatchlist(userId: number, movieId: number): Promise<boolean> {
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

  public async getWatchHistory(userId: number): Promise<WatchProgressRecord[]> {
    const list = this.watchHistory.get(userId) ?? [];
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

  public async getUserProfile(userId: number): Promise<UserProfile> {
    return this.users.find((u) => u.id === userId) ?? this.users[0];
  }
}
