import { MovieRow } from '../db/drizzleSchema';
import { MediaEntity } from './MediaEntity';
import { MovieEntity } from './MovieEntity';
import { SeriesEntity } from './SeriesEntity';
import { Episode, MediaType, MoodTag, MovieDTO, ProviderName } from './types';

export interface TmdbRawItem {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  genre_ids?: number[];
}

const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'ACTION',
  12: 'ADVENTURE',
  16: 'ANIMATION',
  35: 'COMEDY',
  80: 'CRIME',
  99: 'DOCUMENTARY',
  18: 'DRAMA',
  10751: 'FAMILY',
  14: 'FANTASY',
  36: 'HISTORY',
  27: 'HORROR',
  10402: 'MUSIC',
  9648: 'MYSTERY',
  10749: 'ROMANCE',
  878: 'SCI-FI',
  53: 'THRILLER',
  10752: 'WAR',
  37: 'WESTERN',
  10759: 'ACTION',
  10765: 'SCI-FI',
};

const PROVIDERS: ProviderName[] = [
  'NETFLIX',
  'HBOmax',
  'Disney+',
  'sky cinema',
  'sky one',
];

const FALLBACK_BACKDROPS = [
  '/backdrops/interstellar.jpg',
  '/backdrops/blade-runner-2049.jpg',
  '/backdrops/arrival.jpg',
  '/backdrops/inception.jpg',
  '/backdrops/dune.jpg',
  '/backdrops/alita.jpg',
];

/**
 * Factory class responsible for instantiating polymorphic MovieEntity or SeriesEntity objects.
 */
export class MediaFactory {
  public static fromDTO(dto: MovieDTO): MediaEntity {
    if (dto.mediaType === 'tv') {
      return new SeriesEntity(dto);
    }
    return new MovieEntity(dto);
  }

  public static fromDatabaseRow(row: Record<string, unknown>): MediaEntity {
    const movielensId =
      row.movielens_id !== null && row.movielens_id !== undefined
        ? Number(row.movielens_id)
        : null;

    const dto: MovieDTO = {
      id: Number(row.id),
      movielensId,
      tmdbId: Number(row.tmdb_id),
      imdbId: (row.imdb_id as string | null) ?? null,
      mediaType: (row.media_type as MediaType) || 'movie',
      title: String(row.title),
      provider: (row.provider as ProviderName) || 'NETFLIX',
      year: Number(row.release_year || 2021),
      runtimeMinutes: Number(row.runtime_minutes || 110),
      ageRating: String(row.age_rating || '15'),
      resolution: (row.resolution as MovieDTO['resolution']) || '8K',
      genres: Array.isArray(row.genres) ? (row.genres as string[]) : [],
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      moods: Array.isArray(row.moods) ? (row.moods as MoodTag[]) : [],
      synopsis: String(row.synopsis || ''),
      backdropUrl: String(row.backdrop_url || '/backdrops/interstellar.jpg'),
      trailerYoutubeId: (row.trailer_youtube_id as string | null) ?? null,
      seasonsCount: row.seasons_count ? Number(row.seasons_count) : 1,
      episodes: Array.isArray(row.episodes) ? (row.episodes as Episode[]) : [],
      source: movielensId ? 'movielens' : 'local',
    };

    return MediaFactory.fromDTO(dto);
  }

  public static fromDrizzleRow(row: MovieRow): MediaEntity {
    const movielensId = row.movielensId ?? null;
    const dto: MovieDTO = {
      id: row.id,
      movielensId,
      tmdbId: row.tmdbId,
      imdbId: row.imdbId ?? null,
      mediaType: (row.mediaType as MediaType) || 'movie',
      title: row.title,
      provider: (row.provider as ProviderName) || 'NETFLIX',
      year: row.releaseYear ?? 2021,
      runtimeMinutes: row.runtimeMinutes ?? 110,
      ageRating: row.ageRating || '15',
      resolution: (row.resolution as MovieDTO['resolution']) || '8K',
      genres: row.genres ?? [],
      tags: row.tags ?? [],
      moods: (row.moods as MoodTag[]) ?? [],
      synopsis: row.synopsis || '',
      backdropUrl: row.backdropUrl || '/backdrops/interstellar.jpg',
      trailerYoutubeId: row.trailerYoutubeId ?? null,
      seasonsCount: row.seasonsCount ?? 1,
      episodes: row.episodes ?? [],
      source: movielensId ? 'movielens' : 'local',
    };

    return MediaFactory.fromDTO(dto);
  }

  public static fromTmdbPayload(
    item: TmdbRawItem,
    forcedMediaType?: 'movie' | 'tv'
  ): MediaEntity {
    const mediaType =
      forcedMediaType ?? (item.media_type === 'tv' ? 'tv' : 'movie');
    const rawTitle = item.title || item.name || `TMDB #${item.id}`;
    const dateStr = item.release_date || item.first_air_date || '';
    const year = dateStr ? Number(dateStr.slice(0, 4)) || 2021 : 2021;
    const genres = (item.genre_ids ?? [])
      .map((gid) => TMDB_GENRE_MAP[gid])
      .filter((g): g is string => Boolean(g));
    const uniqueGenres = Array.from(
      new Set(genres.length > 0 ? genres : ['CINEMA'])
    );
    const imagePath = item.backdrop_path || item.poster_path;
    const backdropUrl = imagePath
      ? `https://image.tmdb.org/t/p/w1280${imagePath}`
      : FALLBACK_BACKDROPS[item.id % FALLBACK_BACKDROPS.length];

    const dto: MovieDTO = {
      id: -Math.abs(item.id),
      movielensId: null,
      tmdbId: item.id,
      imdbId: null,
      mediaType,
      title: rawTitle.toUpperCase(),
      provider: PROVIDERS[item.id % PROVIDERS.length],
      year,
      runtimeMinutes: mediaType === 'tv' ? 45 : 115,
      ageRating: '15',
      resolution: '8K',
      genres: uniqueGenres,
      tags: ['tmdb-live', mediaType],
      moods: MediaFactory.inferMoods(uniqueGenres),
      synopsis:
        item.overview ||
        `Live TMDB catalog entry (${year}) ready to stream via VidLink Pro.`,
      backdropUrl,
      trailerYoutubeId: null,
      seasonsCount: mediaType === 'tv' ? 1 : undefined,
      episodes: [],
      source: 'tmdb',
    };

    return MediaFactory.fromDTO(dto);
  }

  private static inferMoods(genres: string[]): MoodTag[] {
    const moods = new Set<MoodTag>();
    if (genres.includes('SCI-FI') || genres.includes('MYSTERY')) {
      moods.add('mind-bending');
    }
    if (
      genres.includes('ACTION') ||
      genres.includes('THRILLER') ||
      genres.includes('HORROR')
    ) {
      moods.add('intense');
    }
    if (genres.includes('DRAMA') || genres.includes('ROMANCE')) {
      moods.add('dramatic');
    }
    if (genres.includes('COMEDY') || genres.includes('ANIMATION')) {
      moods.add('fun');
    }
    if (genres.includes('ADVENTURE') || genres.includes('FANTASY')) {
      moods.add('epic');
    }
    if (moods.size === 0) moods.add('calm');
    return Array.from(moods);
  }
}
