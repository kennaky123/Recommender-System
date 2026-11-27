import { MediaEntity } from '../domain/MediaEntity';
import {
  MovieDTO,
  PaginatedCatalogResult,
  RecommendedMovieDTO,
} from '../domain/types';
import {
  IMediaCatalogRepository,
  IStorageStatusProvider,
} from '../repositories/interfaces/RepositoryInterfaces';
import {
  CatalogQueryInput,
  ICatalogService,
  IExternalMediaProvider,
  IRecommendationCacheInvalidator,
  IRecommendationService,
  SearchQueryInput,
} from './interfaces/ServiceInterfaces';

export interface CatalogServiceDeps {
  catalogRepo: IMediaCatalogRepository;
  storageStatus: IStorageStatusProvider;
  externalProvider: IExternalMediaProvider;
  recommender: IRecommendationService;
  cacheInvalidator: IRecommendationCacheInvalidator;
}

/**
 * Application service coordinating catalog browsing, multi-source search, and enrichment (ISP + DIP).
 */
export class CatalogService implements ICatalogService {
  private readonly deps: CatalogServiceDeps;

  public constructor(deps: CatalogServiceDeps) {
    this.deps = deps;
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
    const counts = await this.deps.storageStatus.getCatalogCounts();
    return {
      storageMode: this.deps.storageStatus.getStorageMode(),
      tmdbEnabled: this.deps.externalProvider.isConfigured(),
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

    const tmdbEnabled = this.deps.externalProvider.isConfigured();

    if (input.source === 'tmdb' && tmdbEnabled) {
      const tmdbPage = await this.deps.externalProvider.fetchPopular(
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

    const result = await this.deps.catalogRepo.searchPaginated({
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
        this.deps.storageStatus.getStorageMode() === 'postgres'
          ? 'postgres'
          : 'memory',
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
    const tmdbEnabled = this.deps.externalProvider.isConfigured();
    const dbResult = await this.deps.catalogRepo.searchPaginated({
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
      this.deps.storageStatus.getStorageMode() === 'postgres' ? 'PGSQL' : 'LOCAL',
    ];

    if (input.query.trim() && tmdbEnabled) {
      const tmdbRes = await this.deps.externalProvider.searchMulti(
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

    const inserted = await this.deps.catalogRepo.upsertExternalMedia({
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

    const enriched = await this.deps.externalProvider.enrichMedia(inserted);
    if (
      enriched.backdropUrl !== inserted.backdropUrl ||
      enriched.trailerYoutubeId !== inserted.trailerYoutubeId
    ) {
      await this.deps.catalogRepo.updateMediaEnrichment(inserted.id, {
        backdropUrl: enriched.backdropUrl,
        synopsis: enriched.synopsis,
        runtimeMinutes: enriched.runtimeMinutes,
        trailerYoutubeId: enriched.trailerYoutubeId,
        seasonsCount: enriched.toDTO().seasonsCount,
      });
    }
    this.deps.cacheInvalidator.invalidateCache();
    return this.toRecommendedShell(enriched);
  }

  public async getMediaDetails(id: number): Promise<MovieDTO | null> {
    const entity = await this.deps.catalogRepo.getMediaById(id);
    if (!entity) return null;

    const enriched = await this.deps.externalProvider.enrichMedia(entity);
    if (
      enriched.backdropUrl !== entity.backdropUrl ||
      enriched.trailerYoutubeId !== entity.trailerYoutubeId
    ) {
      await this.deps.catalogRepo.updateMediaEnrichment(entity.id, {
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
    return this.deps.recommender.getSimilarMedia(movieId, userId, limit);
  }
}
