import { httpClient } from '@/lib/httpClient';
import {
  CatalogSort,
  MoodTag,
  NavCategory,
  PaginatedCatalogResponse,
  RecommendationFeed,
  RecommendedMovie,
  SearchCatalogResponse,
  UserProfileResponse,
} from './types';

const USER_ID = 1;

export async function fetchRecommendations(
  mood: MoodTag = 'all',
  category: NavCategory = 'home',
  signal?: AbortSignal
): Promise<RecommendationFeed> {
  const apiCat = category === 'films' || category === 'shows' ? category : 'home';
  const { data } = await httpClient.get<RecommendationFeed>('/recommendations', {
    params: { userId: USER_ID, mood, category: apiCat },
    signal,
  });
  return data;
}

export async function fetchFullCatalog(
  params: {
    category?: 'all' | 'films' | 'shows';
    genre?: string;
    mood?: MoodTag;
    sort?: CatalogSort;
    page?: number;
    limit?: number;
    source?: 'auto' | 'tmdb';
  },
  signal?: AbortSignal
): Promise<PaginatedCatalogResponse> {
  const { data } = await httpClient.get<PaginatedCatalogResponse>('/catalog', {
    params: {
      userId: USER_ID,
      category: params.category ?? 'all',
      genre: params.genre ?? 'ALL',
      mood: params.mood ?? 'all',
      sort: params.sort ?? 'popular',
      page: params.page ?? 1,
      limit: params.limit ?? 24,
      source: params.source ?? 'auto',
    },
    signal,
  });
  return data;
}

export async function fetchSimilarMovies(
  movieId: number,
  signal?: AbortSignal
): Promise<RecommendedMovie[]> {
  const { data } = await httpClient.get<{ items: RecommendedMovie[] }>(
    `/movies/${movieId}/similar`,
    {
      params: { userId: USER_ID, limit: 6 },
      signal,
    }
  );
  return data.items;
}

export async function fetchMovieById(
  movieId: number,
  signal?: AbortSignal
): Promise<RecommendedMovie> {
  const { data } = await httpClient.get<{ movie: RecommendedMovie }>(
    `/movies/${movieId}`,
    { signal }
  );
  return {
    ...data.movie,
    matchScore: data.movie.matchScore ?? 92,
    matchReason: data.movie.matchReason ?? `TMDB #${data.movie.tmdbId}`,
    inMyList: data.movie.inMyList ?? false,
    communityRating: data.movie.communityRating ?? 4.5,
    ratingCount: data.movie.ratingCount ?? 0,
  };
}

export async function searchCatalog(
  query: string,
  mood: MoodTag = 'all',
  genre = 'ALL',
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  page = 1,
  limit = 24,
  signal?: AbortSignal
): Promise<SearchCatalogResponse> {
  const { data } = await httpClient.get<SearchCatalogResponse>('/search', {
    params: {
      userId: USER_ID,
      q: query,
      mood,
      genre,
      mediaType,
      page,
      limit,
    },
    signal,
  });
  return data;
}

export async function ensureMovieInDb(
  movie: RecommendedMovie
): Promise<RecommendedMovie> {
  if (movie.id > 0) return movie;
  const { data } = await httpClient.post<{ movie: RecommendedMovie }>(
    '/movies/ensure',
    movie
  );
  return data.movie;
}

export async function submitRating(
  movieId: number,
  rating: number
): Promise<{ feed: RecommendationFeed }> {
  const { data } = await httpClient.post<{ feed: RecommendationFeed }>(
    `/user/${USER_ID}/ratings`,
    { movieId, rating }
  );
  return data;
}

export async function toggleMyList(
  movieId: number
): Promise<{ inMyList: boolean; feed: RecommendationFeed }> {
  const { data } = await httpClient.post<{
    inMyList: boolean;
    feed: RecommendationFeed;
  }>(`/user/${USER_ID}/watchlist/${movieId}`);
  return data;
}

export async function saveWatchProgress(
  movieId: number,
  progressSeconds: number,
  durationSeconds: number,
  season = 1,
  episode = 1
): Promise<{ feed: RecommendationFeed }> {
  const { data } = await httpClient.post<{ feed: RecommendationFeed }>(
    `/user/${USER_ID}/watch-progress`,
    {
      movieId,
      progressSeconds,
      durationSeconds,
      season,
      episode,
    }
  );
  return data;
}

export async function fetchUserProfile(
  signal?: AbortSignal
): Promise<UserProfileResponse> {
  const { data } = await httpClient.get<UserProfileResponse>(
    `/user/${USER_ID}/profile`,
    { signal }
  );
  return data;
}
