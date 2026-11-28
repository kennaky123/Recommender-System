import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import {
  fetchFullCatalog,
  fetchMovieById,
  fetchRecommendations,
  fetchSimilarMovies,
  fetchUserProfile,
  searchCatalog,
} from '@/api';
import { vodQueryKeys } from '@/lib/queryClient';
import { CatalogSort, MoodTag, NavCategory } from '@/types';

export function useRecommendationsQuery(
  userId: number,
  mood: MoodTag,
  category: NavCategory
) {
  return useQuery({
    queryKey: vodQueryKeys.recommendations(userId, mood, category),
    queryFn: ({ signal }) =>
      fetchRecommendations(userId, mood, category, signal),
    placeholderData: keepPreviousData,
  });
}

export function useFullCatalogQuery(params: {
  userId: number;
  category: 'all' | 'films' | 'shows';
  genre: string;
  mood: MoodTag;
  sort: CatalogSort;
  page: number;
  source: 'auto' | 'tmdb';
}) {
  return useQuery({
    queryKey: vodQueryKeys.catalog(params),
    queryFn: ({ signal }) =>
      fetchFullCatalog({ ...params, limit: 24 }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSearchCatalogInfiniteQuery(params: {
  userId: number;
  q: string;
  genre: string;
  mediaType: 'all' | 'movie' | 'tv';
}) {
  return useInfiniteQuery({
    queryKey: vodQueryKeys.search(params),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      searchCatalog(
        params.q,
        params.userId,
        'all',
        params.genre,
        params.mediaType,
        pageParam,
        24,
        signal
      ),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}

export function useMovieDetailQuery(movieId: number, enabled = true) {
  return useQuery({
    queryKey: vodQueryKeys.movie(movieId),
    queryFn: ({ signal }) => fetchMovieById(movieId, signal),
    enabled: enabled && Number.isFinite(movieId) && movieId > 0,
  });
}

export function useSimilarMoviesQuery(movieId: number, userId = 1) {
  return useQuery({
    queryKey: vodQueryKeys.similar(movieId, userId),
    queryFn: ({ signal }) => fetchSimilarMovies(movieId, userId, signal),
    enabled: Number.isFinite(movieId) && movieId > 0,
  });
}

export function useUserProfileQuery(userId: number, enabled = true) {
  return useQuery({
    queryKey: vodQueryKeys.userProfile(userId),
    queryFn: ({ signal }) => fetchUserProfile(userId, signal),
    enabled: enabled && Number.isFinite(userId) && userId > 0,
  });
}
