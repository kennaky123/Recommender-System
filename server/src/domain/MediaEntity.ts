import { MediaType, MoodTag, MovieDTO, ProviderName } from './types';

/**
 * Abstract base domain entity representing a streamable Movie or Series.
 * Demonstrates Abstraction, Encapsulation, and Polymorphism.
 */
export abstract class MediaEntity {
  public readonly id: number;
  public readonly movielensId: number | null;
  public readonly tmdbId: number;
  public readonly imdbId: string | null;
  public readonly mediaType: MediaType;
  public readonly title: string;
  public readonly provider: ProviderName;
  public readonly year: number;
  public readonly runtimeMinutes: number;
  public readonly ageRating: string;
  public readonly resolution: '8K' | '4K' | 'HD';
  public readonly genres: string[];
  public readonly tags: string[];
  public readonly moods: MoodTag[];
  public readonly synopsis: string;
  public readonly backdropUrl: string;
  public readonly trailerYoutubeId: string | null;
  public readonly source: 'local' | 'movielens' | 'tmdb';

  protected constructor(dto: MovieDTO) {
    this.id = dto.id;
    this.movielensId = dto.movielensId ?? null;
    this.tmdbId = dto.tmdbId;
    this.imdbId = dto.imdbId ?? null;
    this.mediaType = dto.mediaType;
    this.title = dto.title;
    this.provider = dto.provider;
    this.year = dto.year;
    this.runtimeMinutes = dto.runtimeMinutes;
    this.ageRating = dto.ageRating;
    this.resolution = dto.resolution;
    this.genres = [...dto.genres];
    this.tags = [...dto.tags];
    this.moods = [...dto.moods];
    this.synopsis = dto.synopsis;
    this.backdropUrl = dto.backdropUrl;
    this.trailerYoutubeId = dto.trailerYoutubeId ?? null;
    this.source = dto.source ?? (dto.movielensId ? 'movielens' : 'local');
  }

  public abstract getStreamUrl(season?: number, episode?: number): string;
  public abstract getMediaCategoryLabel(): string;

  public buildFeatureVector(): Map<string, number> {
    const vec = new Map<string, number>();
    for (const g of this.genres) {
      vec.set(`genre:${g.toUpperCase()}`, 1.4);
    }
    for (const t of this.tags) {
      vec.set(`tag:${t.toLowerCase()}`, 1.0);
    }
    for (const m of this.moods) {
      vec.set(`mood:${m.toLowerCase()}`, 0.9);
    }
    return vec;
  }

  public matchesMood(mood: MoodTag): boolean {
    return mood === 'all' || this.moods.includes(mood);
  }

  public hasGenre(genre: string): boolean {
    if (!genre || genre.toUpperCase() === 'ALL') return true;
    const upper = genre.toUpperCase();
    return this.genres.some((g) => g.toUpperCase() === upper);
  }

  public toDTO(): MovieDTO {
    return {
      id: this.id,
      movielensId: this.movielensId,
      tmdbId: this.tmdbId,
      imdbId: this.imdbId,
      mediaType: this.mediaType,
      title: this.title,
      provider: this.provider,
      year: this.year,
      runtimeMinutes: this.runtimeMinutes,
      ageRating: this.ageRating,
      resolution: this.resolution,
      genres: [...this.genres],
      tags: [...this.tags],
      moods: [...this.moods],
      synopsis: this.synopsis,
      backdropUrl: this.backdropUrl,
      trailerYoutubeId: this.trailerYoutubeId,
      source: this.source,
    };
  }
}
