import { ITmdbConfig } from '../config/IConfig';
import { MediaEntity } from '../domain/MediaEntity';
import { MediaFactory, TmdbRawItem } from '../domain/MediaFactory';
import { MovieDTO } from '../domain/types';
import { IExternalMediaProvider } from './interfaces/ServiceInterfaces';

/**
 * External media provider client for TMDB v3/v4 APIs (DIP + ISP).
 */
export class TmdbApiClient implements IExternalMediaProvider {
  private static readonly BASE_URL = 'https://api.themoviedb.org/3';
  private readonly config: ITmdbConfig;
  private readonly backdropCache = new Map<string, string>();

  public constructor(config: ITmdbConfig) {
    this.config = config;
  }

  public isConfigured(): boolean {
    return this.config.isTmdbConfigured();
  }

  private async request<T>(pathAndQuery: string): Promise<T | null> {
    if (!this.isConfigured()) return null;

    const separator = pathAndQuery.includes('?') ? '&' : '?';
    const url = this.config.tmdbApiKey
      ? `${TmdbApiClient.BASE_URL}${pathAndQuery}${separator}api_key=${encodeURIComponent(
          this.config.tmdbApiKey
        )}`
      : `${TmdbApiClient.BASE_URL}${pathAndQuery}`;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.config.tmdbAccessToken) {
      headers.Authorization = `Bearer ${this.config.tmdbAccessToken}`;
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  public async searchMulti(
    query: string,
    page = 1,
    mediaType: 'all' | 'movie' | 'tv' = 'all'
  ): Promise<{ items: MediaEntity[]; total: number; totalPages: number }> {
    if (!this.isConfigured() || !query.trim()) {
      return { items: [], total: 0, totalPages: 0 };
    }

    const endpoint =
      mediaType === 'movie'
        ? `/search/movie?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`
        : mediaType === 'tv'
        ? `/search/tv?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`
        : `/search/multi?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`;

    const data = await this.request<{
      results?: TmdbRawItem[];
      total_results?: number;
      total_pages?: number;
    }>(endpoint);

    if (!data?.results) {
      return { items: [], total: 0, totalPages: 0 };
    }

    const forced = mediaType === 'all' ? undefined : mediaType;
    const items = data.results
      .filter((r) =>
        r.media_type ? r.media_type === 'movie' || r.media_type === 'tv' : true
      )
      .map((r) => MediaFactory.fromTmdbPayload(r, forced));

    return {
      items,
      total: data.total_results ?? items.length,
      totalPages: Math.min(500, data.total_pages ?? 1),
    };
  }

  public async fetchPopular(
    mediaType: 'all' | 'movie' | 'tv' = 'all',
    page = 1
  ): Promise<{ items: MediaEntity[]; total: number; totalPages: number }> {
    if (!this.isConfigured()) {
      return { items: [], total: 0, totalPages: 0 };
    }

    const endpoint =
      mediaType === 'tv'
        ? `/tv/popular?page=${page}`
        : mediaType === 'movie'
        ? `/movie/popular?page=${page}`
        : `/trending/all/week?page=${page}`;

    const data = await this.request<{
      results?: TmdbRawItem[];
      total_results?: number;
      total_pages?: number;
    }>(endpoint);

    if (!data?.results) {
      return { items: [], total: 0, totalPages: 0 };
    }

    const forced = mediaType === 'all' ? undefined : mediaType;
    const items = data.results
      .filter((r) =>
        r.media_type ? r.media_type === 'movie' || r.media_type === 'tv' : true
      )
      .map((r) => MediaFactory.fromTmdbPayload(r, forced));

    return {
      items,
      total: data.total_results ?? items.length,
      totalPages: Math.min(500, data.total_pages ?? 1),
    };
  }

  public async enrichMedia(entity: MediaEntity): Promise<MediaEntity> {
    if (!this.isConfigured()) return entity;
    const cacheKey = `${entity.mediaType}:${entity.tmdbId}`;
    if (this.backdropCache.has(cacheKey) && entity.backdropUrl.startsWith('http')) {
      return entity;
    }

    const data = await this.request<{
      backdrop_path?: string;
      overview?: string;
      runtime?: number;
      episode_run_time?: number[];
      number_of_seasons?: number;
      videos?: { results?: Array<{ key: string; site: string; type: string }> };
    }>(`/${entity.mediaType}/${entity.tmdbId}?append_to_response=videos`);

    if (!data) return entity;

    const trailer = data.videos?.results?.find(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );
    const backdropUrl = data.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
      : entity.backdropUrl;

    if (data.backdrop_path) {
      this.backdropCache.set(cacheKey, backdropUrl);
    }

    const baseDto = entity.toDTO();
    const enrichedDto: MovieDTO = {
      ...baseDto,
      backdropUrl,
      synopsis: data.overview || baseDto.synopsis,
      runtimeMinutes:
        data.runtime || data.episode_run_time?.[0] || baseDto.runtimeMinutes,
      seasonsCount: data.number_of_seasons ?? baseDto.seasonsCount,
      trailerYoutubeId: trailer?.key ?? baseDto.trailerYoutubeId,
    };

    return MediaFactory.fromDTO(enrichedDto);
  }
}
