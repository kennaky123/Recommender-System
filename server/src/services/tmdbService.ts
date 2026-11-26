import { TMDB_ACCESS_TOKEN, TMDB_API_KEY } from '../config';
import { MoodTag, Movie, ProviderName } from '../types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const backdropCache = new Map<string, string>();

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

export function isTmdbConfigured(): boolean {
  return Boolean(TMDB_API_KEY.trim() || TMDB_ACCESS_TOKEN.trim());
}

function inferMoods(genres: string[]): MoodTag[] {
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

async function tmdbFetch<T>(pathAndQuery: string): Promise<T | null> {
  if (!isTmdbConfigured()) return null;
  const separator = pathAndQuery.includes('?') ? '&' : '?';
  const url = TMDB_API_KEY
    ? `${TMDB_BASE}${pathAndQuery}${separator}api_key=${encodeURIComponent(
        TMDB_API_KEY
      )}`
    : `${TMDB_BASE}${pathAndQuery}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (TMDB_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${TMDB_ACCESS_TOKEN}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface TmdbSearchItem {
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
  vote_average?: number;
}

function mapTmdbItemToMovie(
  item: TmdbSearchItem,
  forcedMediaType?: 'movie' | 'tv'
): Movie {
  const mediaType =
    forcedMediaType ?? (item.media_type === 'tv' ? 'tv' : 'movie');
  const rawTitle = item.title || item.name || `TMDB #${item.id}`;
  const dateStr = item.release_date || item.first_air_date || '';
  const year = dateStr ? Number(dateStr.slice(0, 4)) || 2021 : 2021;
  const genres = (item.genre_ids ?? [])
    .map((gid) => TMDB_GENRE_MAP[gid])
    .filter((g): g is string => Boolean(g));
  const uniqueGenres = Array.from(new Set(genres.length > 0 ? genres : ['CINEMA']));
  const imagePath = item.backdrop_path || item.poster_path;
  const backdropUrl = imagePath
    ? `https://image.tmdb.org/t/p/w1280${imagePath}`
    : FALLBACK_BACKDROPS[item.id % FALLBACK_BACKDROPS.length];

  return {
    id: -Math.abs(item.id), // negative transient ID until ensured in PostgreSQL
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
    moods: inferMoods(uniqueGenres),
    synopsis:
      item.overview ||
      `Live TMDB catalog entry (${year}) ready to stream via VidLink Pro.`,
    backdropUrl,
    trailerYoutubeId: null,
    seasonsCount: mediaType === 'tv' ? 1 : undefined,
    episodes: [],
    source: 'tmdb',
  };
}

export async function searchTmdbMulti(
  query: string,
  page = 1,
  mediaType: 'all' | 'movie' | 'tv' = 'all'
): Promise<{ items: Movie[]; total: number; totalPages: number }> {
  if (!isTmdbConfigured() || !query.trim()) {
    return { items: [], total: 0, totalPages: 0 };
  }

  const endpoint =
    mediaType === 'movie'
      ? `/search/movie?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`
      : mediaType === 'tv'
      ? `/search/tv?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`
      : `/search/multi?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`;

  const data = await tmdbFetch<{
    results?: TmdbSearchItem[];
    total_results?: number;
    total_pages?: number;
  }>(endpoint);

  if (!data?.results) {
    return { items: [], total: 0, totalPages: 0 };
  }

  const forced = mediaType === 'all' ? undefined : mediaType;
  const items = data.results
    .filter((r) => (r.media_type ? r.media_type === 'movie' || r.media_type === 'tv' : true))
    .map((r) => mapTmdbItemToMovie(r, forced));

  return {
    items,
    total: data.total_results ?? items.length,
    totalPages: Math.min(500, data.total_pages ?? 1),
  };
}

export async function fetchTmdbPopular(
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  page = 1
): Promise<{ items: Movie[]; total: number; totalPages: number }> {
  if (!isTmdbConfigured()) {
    return { items: [], total: 0, totalPages: 0 };
  }

  const endpoint =
    mediaType === 'tv'
      ? `/tv/popular?page=${page}`
      : mediaType === 'movie'
      ? `/movie/popular?page=${page}`
      : `/trending/all/week?page=${page}`;

  const data = await tmdbFetch<{
    results?: TmdbSearchItem[];
    total_results?: number;
    total_pages?: number;
  }>(endpoint);

  if (!data?.results) {
    return { items: [], total: 0, totalPages: 0 };
  }

  const forced = mediaType === 'all' ? undefined : mediaType;
  const items = data.results
    .filter((r) => (r.media_type ? r.media_type === 'movie' || r.media_type === 'tv' : true))
    .map((r) => mapTmdbItemToMovie(r, forced));

  return {
    items,
    total: data.total_results ?? items.length,
    totalPages: Math.min(500, data.total_pages ?? 1),
  };
}

export async function enrichMovieBackdrop(movie: Movie): Promise<Movie> {
  if (!isTmdbConfigured()) return movie;
  const cacheKey = `${movie.mediaType}:${movie.tmdbId}`;
  const cached = backdropCache.get(cacheKey);
  if (cached && movie.backdropUrl.startsWith('http')) {
    return movie;
  }

  const data = await tmdbFetch<{
    backdrop_path?: string;
    overview?: string;
    runtime?: number;
    episode_run_time?: number[];
    number_of_seasons?: number;
    videos?: { results?: Array<{ key: string; site: string; type: string }> };
  }>(`/${movie.mediaType}/${movie.tmdbId}?append_to_response=videos`);

  if (!data) return movie;

  const trailer = data.videos?.results?.find(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );
  const backdropUrl = data.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
    : movie.backdropUrl;
  if (data.backdrop_path) {
    backdropCache.set(cacheKey, backdropUrl);
  }

  return {
    ...movie,
    backdropUrl,
    synopsis: data.overview || movie.synopsis,
    runtimeMinutes:
      data.runtime || data.episode_run_time?.[0] || movie.runtimeMinutes,
    seasonsCount: data.number_of_seasons ?? movie.seasonsCount,
    trailerYoutubeId: trailer?.key ?? movie.trailerYoutubeId,
  };
}
