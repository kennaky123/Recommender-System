import { QueryClient } from '@tanstack/react-query';
import { CatalogSort, MoodTag, NavCategory } from '@/types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const vodQueryKeys = {
  all: ['vod'] as const,
  recommendations: (mood: MoodTag, category: NavCategory) =>
    [...vodQueryKeys.all, 'recommendations', { mood, category }] as const,
  recommendationsRoot: () => [...vodQueryKeys.all, 'recommendations'] as const,
  catalog: (params: {
    category: 'all' | 'films' | 'shows';
    genre: string;
    mood: MoodTag;
    sort: CatalogSort;
    page: number;
    source: 'auto' | 'tmdb';
  }) => [...vodQueryKeys.all, 'catalog', params] as const,
  search: (params: {
    q: string;
    genre: string;
    mediaType: 'all' | 'movie' | 'tv';
  }) => [...vodQueryKeys.all, 'search', params] as const,
  movie: (movieId: number) => [...vodQueryKeys.all, 'movie', movieId] as const,
  similar: (movieId: number) =>
    [...vodQueryKeys.all, 'similar', movieId] as const,
  userProfile: () => [...vodQueryKeys.all, 'userProfile'] as const,
};
