import { MediaEntity } from '../domain/MediaEntity';
import {
  CatalogSort,
  MoodTag,
  MovieDTO,
  PaginatedCatalogResult,
  RecommendedMovieDTO,
} from '../domain/types';
import { IMediaRepository } from '../repositories/IMediaRepository';
import { HybridRecommendationService } from './recommendation/HybridRecommendationService';
import { TmdbApiClient } from './TmdbApiClient';

export interface SearchQueryInput {
  userId: number;
  query: string;
  mood: MoodTag;
  genre: string;
  mediaType: 'all' | 'movie' | 'tv';
  page: number;
  limit: number;
}

export interface CatalogQueryInput {
  userId: number;
  category: string;
  mediaType: 'all' | 'movie' | 'tv';
  genre: string;
  mood: MoodTag;
  sort: CatalogSort;
  page: number;
  limit: number;
  source: string;
}

/**
 * Application service coordinating catalog browsing, multi-source search, and TMDB enrichment.
 */
export class CatalogService {
  private readonly repository: IMediaRepository;
  private readonly tmdbClient: TmdbApiClient;
  private readonly recommender: HybridRecommendationService;

  public constructor(
    repository: IMediaRepository,
    tmdbClient: TmdbApiClient,
    recommender: HybridRecommendationService
  ) {
    this.repository = repository;
    this.tmdbClient = tmdbClient;
    this.recommender = recommender;
  }

  private toRecommendedShell(entity: MediaEntity): RecommendedMovieDTO {
    return {
      ...entity.toDTO(),
      matchScore: 90,
      matchReason:
        entity.source === 'tmdb'
          ? `TMDB LIVE • #${entity.tmdbId}`
          : `TMDB #${entity.tmdbId}`,
      inMyList: false,
      communityRating: 4.2,
      ratingCount: 0,
    };
  }

  public async getHealthSnapshot(): Promise<{
    storageMode: 'postgres' | 'memory-fallback';
    tmdbEnabled: boolean;
    movieCount: number;
    ratingCount: number;
  }> {
    const counts = await this.repository.getCatalogCounts();
    return {
      storageMode: this.repository.getStorageMode(),
      tmdbEnabled: this.tmdbClient.isConfigured(),
      movieCount: counts.movieCount,
      ratingCount: counts.ratingCount,
    };
  }

  public async getCatalog(input: CatalogQueryInput): Promise<PaginatedCatalogResult> {
    const resolvedMediaType =
      input.category === 'films'
        ? 'movie'
        : input.category === 'shows'
        ? 'tv'
        : input.mediaType;

    const tmdbEnabled = this.tmdbClient.isConfigured();

    if (input.source === 'tmdb' && tmdbEnabled) {
      const tmdbPage = await this.tmdbClient.fetchPopular(
        resolvedMediaType,
        input.page
      );
      return {
        items: tmdbPage.items.map((e) => this.toRecommendedShell(e)),
        total: tmdbPage.total,
        page: input.page,
        totalPages: tmdbPage.totalPages,
        tmdbEnabled,
        source: 'tmdb',
      };
    }

    const result = await this.repository.searchPaginated({
      userId: input.userId,
      mood: input.mood,
      genre: input.genre,
      mediaType: resolvedMediaType,
      sort: input.sort,
      page: input.page,
      limit: input.limit,
    });

    return {
      ...result,
      tmdbEnabled,
      source:
        this.repository.getStorageMode() === 'postgres' ? 'postgres' : 'memory',
    };
  }

  public async search(input: SearchQueryInput): Promise<{
    movies: RecommendedMovieDTO[];
    total: number;
    page: number;
    totalPages: number;
    tmdbEnabled: boolean;
    sourcesUsed: string[];
  }> {
    const tmdbEnabled = this.tmdbClient.isConfigured();
    const dbResult = await this.repository.searchPaginated({
      userId: input.userId,
      query: input.query,
      mood: input.mood,
      genre: input.genre,
      mediaType: input.mediaType,
      sort: 'popular',
      page: input.page,
      limit: input.limit,
    });

    let mergedMovies = dbResult.items;
    let total = dbResult.total;
    let totalPages = dbResult.totalPages;
    const sourcesUsed = [
      this.repository.getStorageMode() === 'postgres' ? 'PGSQL' : 'LOCAL',
    ];

    if (input.query.trim() && tmdbEnabled) {
      const tmdbRes = await this.tmdbClient.searchMulti(
        input.query,
        input.page,
        input.mediaType
      );
      if (tmdbRes.items.length > 0) {
        sourcesUsed.push('TMDB LIVE');
        const seen = new Set(
          mergedMovies.map((m) => `${m.mediaType}:${m.tmdbId}`)
        );
        const extra = tmdbRes.items
          .filter((item) => !seen.has(`${item.mediaType}:${item.tmdbId}`))
          .map((item) => this.toRecommendedShell(item));
        mergedMovies = [...mergedMovies, ...extra];
        total = Math.max(total, tmdbRes.total);
        totalPages = Math.max(totalPages, tmdbRes.totalPages);
      }
    }

    return {
      movies: mergedMovies,
      total,
      page: input.page,
      totalPages,
      tmdbEnabled,
      sourcesUsed,
    };
  }

  public async ensureExternalMedia(
    payload: Partial<MovieDTO>
  ): Promise<RecommendedMovieDTO> {
    if (!payload.tmdbId || !payload.title) {
      throw new Error('tmdbId and title are required');
    }

    const inserted = await this.repository.upsertExternalMedia({
      movielensId: payload.movielensId ?? null,
      tmdbId: Number(payload.tmdbId),
      imdbId: payload.imdbId ?? null,
      mediaType: payload.mediaType === 'tv' ? 'tv' : 'movie',
      title: String(payload.title).toUpperCase(),
      provider: payload.provider || 'NETFLIX',
      year: Number(payload.year) || 2021,
      runtimeMinutes: Number(payload.runtimeMinutes) || 115,
      ageRating: payload.ageRating || '15',
      resolution: payload.resolution || '8K',
      genres: Array.isArray(payload.genres) ? payload.genres : ['CINEMA'],
      tags: Array.isArray(payload.tags) ? payload.tags : ['tmdb-live'],
      moods: Array.isArray(payload.moods) ? payload.moods : ['dramatic'],
      synopsis: payload.synopsis || '',
      backdropUrl: payload.backdropUrl || '/backdrops/interstellar.jpg',
      trailerYoutubeId: payload.trailerYoutubeId ?? null,
      seasonsCount: payload.seasonsCount ?? 1,
      episodes: payload.episodes ?? [],
      source: 'tmdb',
    });

    const enriched = await this.tmdbClient.enrichMedia(inserted);
    if (
      enriched.backdropUrl !== inserted.backdropUrl ||
      enriched.trailerYoutubeId !== inserted.trailerYoutubeId
    ) {
      await this.repository.updateMediaEnrichment(inserted.id, {
        backdropUrl: enriched.backdropUrl,
        synopsis: enriched.synopsis,
        runtimeMinutes: enriched.runtimeMinutes,
        trailerYoutubeId: enriched.trailerYoutubeId,
        seasonsCount: enriched.toDTO().seasonsCount,
      });
    }
    this.recommender.invalidateCache();
    return this.toRecommendedShell(enriched);
  }

  public async getMediaDetails(id: number): Promise<MovieDTO | null> {
    const entity = await this.repository.getMediaById(id);
    if (!entity) return null;

    const enriched = await this.tmdbClient.enrichMedia(entity);
    if (
      enriched.backdropUrl !== entity.backdropUrl ||
      enriched.trailerYoutubeId !== entity.trailerYoutubeId
    ) {
      await this.repository.updateMediaEnrichment(entity.id, {
        backdropUrl: enriched.backdropUrl,
        synopsis: enriched.synopsis,
        runtimeMinutes: enriched.runtimeMinutes,
        trailerYoutubeId: enriched.trailerYoutubeId,
        seasonsCount: enriched.toDTO().seasonsCount,
      });
    }
    return enriched.toDTO();
  }

  public async getSimilar(
    movieId: number,
    userId = 1,
    limit = 6
  ): Promise<RecommendedMovieDTO[]> {
    return this.recommender.getSimilarMedia(movieId, userId, limit);
  }
}
