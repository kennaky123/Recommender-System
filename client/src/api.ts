import {
  MoodTag,
  NavCategory,
  RecommendationFeed,
  RecommendedMovie,
  UserProfileResponse,
} from './types';

const USER_ID = 1;

export async function fetchRecommendations(
  mood: MoodTag = 'all',
  category: NavCategory = 'home'
): Promise<RecommendationFeed> {
  const apiCat = category === 'films' || category === 'shows' ? category : 'home';
  const res = await fetch(
    `/api/recommendations?userId=${USER_ID}&mood=${encodeURIComponent(mood)}&category=${encodeURIComponent(apiCat)}`
  );
  if (!res.ok) throw new Error('Failed to load recommendations');
  return res.json();
}

export async function fetchSimilarMovies(movieId: number): Promise<RecommendedMovie[]> {
  const res = await fetch(`/api/movies/${movieId}/similar?userId=${USER_ID}&limit=6`);
  if (!res.ok) throw new Error('Failed to load similar movies');
  const data = (await res.json()) as { items: RecommendedMovie[] };
  return data.items;
}

export async function searchCatalog(
  query: string,
  mood: MoodTag = 'all',
  genre = 'ALL'
): Promise<RecommendedMovie[]> {
  const params = new URLSearchParams({ q: query, mood, genre });
  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  const data = (await res.json()) as { movies: RecommendedMovie[] };
  return data.movies;
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
