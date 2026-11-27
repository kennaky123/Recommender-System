import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import {
  fetchFullCatalog,
  fetchMovieById,
  fetchRecommendations,
  fetchUserProfile,
  searchCatalog,
} from '@/api';
import { vodQueryKeys } from '@/lib/queryClient';
import { CatalogSort, MoodTag, NavCategory } from '@/types';

export function useRecommendationsQuery(
  mood: MoodTag,
  category: NavCategory
) {
  return useQuery({
    queryKey: vodQueryKeys.recommendations(mood, category),
    queryFn: ({ signal }) => fetchRecommendations(mood, category, signal),
    placeholderData: keepPreviousData,
  });
}

export function useFullCatalogQuery(params: {
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

export function useUserProfileQuery() {
  return useQuery({
    queryKey: vodQueryKeys.userProfile(),
    queryFn: ({ signal }) => fetchUserProfile(signal),
  });
}
