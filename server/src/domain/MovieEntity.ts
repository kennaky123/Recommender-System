import { MediaEntity } from './MediaEntity';
import { MovieDTO } from './types';

/**
 * Concrete domain entity for standalone feature films.
 */
export class MovieEntity extends MediaEntity {
  public constructor(dto: MovieDTO) {
    super({ ...dto, mediaType: 'movie' });
  }

  public getStreamUrl(): string {
    return `https://vidlink.pro/movie/${this.tmdbId}`;
  }

  public getMediaCategoryLabel(): string {
    return 'FILM';
  }
}
