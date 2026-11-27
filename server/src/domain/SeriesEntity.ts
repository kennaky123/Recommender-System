import { MediaEntity } from './MediaEntity';
import { Episode, MovieDTO } from './types';

/**
 * Concrete domain entity for multi-season TV series.
 */
export class SeriesEntity extends MediaEntity {
  public readonly seasonsCount: number;
  public readonly episodes: Episode[];

  public constructor(dto: MovieDTO) {
    super({ ...dto, mediaType: 'tv' });
    this.seasonsCount = dto.seasonsCount ?? 1;
    this.episodes = [...(dto.episodes ?? [])];
  }

  public getStreamUrl(season = 1, episode = 1): string {
    return `https://vidlink.pro/tv/${this.tmdbId}/${season}/${episode}`;
  }

  public getMediaCategoryLabel(): string {
    return 'SERIES';
  }

  public getEpisodesBySeason(season: number): Episode[] {
    return this.episodes.filter((ep) => ep.season === season);
  }

  public override toDTO(): MovieDTO {
    return {
      ...super.toDTO(),
      seasonsCount: this.seasonsCount,
      episodes: [...this.episodes],
    };
  }
}
