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
  category: NavCategory = 'home'
): Promise<RecommendationFeed> {
  const apiCat = category === 'films' || category === 'shows' ? category : 'home';
  const res = await fetch(
    `/api/recommendations?userId=${USER_ID}&mood=${encodeURIComponent(
      mood
    )}&category=${encodeURIComponent(apiCat)}`
  );
  if (!res.ok) throw new Error('Failed to load recommendations');
  return res.json();
}

export async function fetchFullCatalog(params: {
  category?: 'all' | 'films' | 'shows';
  genre?: string;
  mood?: MoodTag;
  sort?: CatalogSort;
  page?: number;
  limit?: number;
  source?: 'auto' | 'tmdb';
}): Promise<PaginatedCatalogResponse> {
  const qs = new URLSearchParams({
    userId: String(USER_ID),
    category: params.category ?? 'all',
    genre: params.genre ?? 'ALL',
    mood: params.mood ?? 'all',
    sort: params.sort ?? 'popular',
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 24),
    source: params.source ?? 'auto',
  });
  const res = await fetch(`/api/catalog?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch catalog');
  return res.json();
}

export async function fetchSimilarMovies(
  movieId: number
): Promise<RecommendedMovie[]> {
  const res = await fetch(`/api/movies/${movieId}/similar?userId=${USER_ID}&limit=6`);
  if (!res.ok) throw new Error('Failed to load similar movies');
  const data = (await res.json()) as { items: RecommendedMovie[] };
  return data.items;
}

export async function fetchMovieById(
  movieId: number
): Promise<RecommendedMovie> {
  const res = await fetch(`/api/movies/${movieId}`);
  if (!res.ok) throw new Error('Failed to load title details');
  const data = (await res.json()) as { movie: RecommendedMovie };
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
  limit = 24
): Promise<SearchCatalogResponse> {
  const params = new URLSearchParams({
    userId: String(USER_ID),
    q: query,
    mood,
    genre,
    mediaType,
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function ensureMovieInDb(
  movie: RecommendedMovie
): Promise<RecommendedMovie> {
  if (movie.id > 0) return movie;
  const res = await fetch('/api/movies/ensure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(movie),
  });
  if (!res.ok) throw new Error('Failed to register movie');
  const data = (await res.json()) as { movie: RecommendedMovie };
  return data.movie;
}

export async function submitRating(
  movieId: number,
  rating: number
): Promise<{ feed: RecommendationFeed }> {
  const res = await fetch(`/api/user/${USER_ID}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ movieId, rating }),
  });
  if (!res.ok) throw new Error('Failed to save rating');
  return res.json();
}

export async function toggleMyList(
  movieId: number
): Promise<{ inMyList: boolean; feed: RecommendationFeed }> {
  const res = await fetch(`/api/user/${USER_ID}/watchlist/${movieId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to update My List');
  return res.json();
}

export async function saveWatchProgress(
  movieId: number,
  progressSeconds: number,
  durationSeconds: number,
  season = 1,
  episode = 1
): Promise<{ feed: RecommendationFeed }> {
  const res = await fetch(`/api/user/${USER_ID}/watch-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      movieId,
      progressSeconds,
      durationSeconds,
      season,
      episode,
    }),
  });
  if (!res.ok) throw new Error('Failed to save watch progress');
  return res.json();
}

export async function fetchUserProfile(): Promise<UserProfileResponse> {
  const res = await fetch(`/api/user/${USER_ID}/profile`);
  if (!res.ok) throw new Error('Failed to fetch user profile');
  return res.json();
}
