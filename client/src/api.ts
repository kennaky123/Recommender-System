import { httpClient } from '@/lib/httpClient';
import {
  AuthResponse,
  AuthUser,
  CatalogSort,
  MoodTag,
  NavCategory,
  PaginatedCatalogResponse,
  RecommendationFeed,
  RecommendedMovie,
  SearchCatalogResponse,
  UserProfileResponse,
} from './types';

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const { data } = await httpClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const { data } = await httpClient.post<AuthResponse>(
    '/auth/register',
    payload
  );
  return data;
}

export async function fetchCurrentUser(
  signal?: AbortSignal
): Promise<AuthUser> {
  const { data } = await httpClient.get<{ user: AuthUser }>('/auth/me', {
    signal,
  });
  return data.user;
}

export async function fetchRecommendations(
  userId = 1,
  mood: MoodTag = 'all',
  category: NavCategory = 'home',
  signal?: AbortSignal
): Promise<RecommendationFeed> {
  const apiCat = category === 'films' || category === 'shows' ? category : 'home';
  const { data } = await httpClient.get<RecommendationFeed>('/recommendations', {
    params: { userId, mood, category: apiCat },
    signal,
  });
  return data;
}

export async function fetchFullCatalog(
  params: {
    userId?: number;
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
      userId: params.userId ?? 1,
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
  userId = 1,
  signal?: AbortSignal
): Promise<RecommendedMovie[]> {
  const { data } = await httpClient.get<{ items: RecommendedMovie[] }>(
    `/movies/${movieId}/similar`,
    {
      params: { userId, limit: 6 },
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
  userId = 1,
  mood: MoodTag = 'all',
  genre = 'ALL',
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  page = 1,
  limit = 24,
  signal?: AbortSignal
): Promise<SearchCatalogResponse> {
  const { data } = await httpClient.get<SearchCatalogResponse>('/search', {
    params: {
      userId,
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
  userId: number,
  movieId: number,
  rating: number
): Promise<{ feed: RecommendationFeed }> {
  const { data } = await httpClient.post<{ feed: RecommendationFeed }>(
    `/user/${userId}/ratings`,
    { movieId, rating }
  );
  return data;
}

export async function toggleMyList(
  userId: number,
  movieId: number
): Promise<{ inMyList: boolean; feed: RecommendationFeed }> {
  const { data } = await httpClient.post<{
    inMyList: boolean;
    feed: RecommendationFeed;
  }>(`/user/${userId}/watchlist/${movieId}`);
  return data;
}

export async function saveWatchProgress(
  userId: number,
  movieId: number,
  progressSeconds: number,
  durationSeconds: number,
  season = 1,
  episode = 1
): Promise<{ feed: RecommendationFeed }> {
  const { data } = await httpClient.post<{ feed: RecommendationFeed }>(
    `/user/${userId}/watch-progress`,
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
  userId = 1,
  signal?: AbortSignal
): Promise<UserProfileResponse> {
  const { data } = await httpClient.get<UserProfileResponse>(
    `/user/${userId}/profile`,
    { signal }
  );
  return data;
}
