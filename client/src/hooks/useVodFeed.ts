import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ensureMovieInDb,
  saveWatchProgress,
  submitRating,
  toggleMyList,
} from '@/api';
import { useRecommendationsQuery } from '@/hooks/useVodQueries';
import { vodQueryKeys } from '@/lib/queryClient';
import { useCabinUiStore } from '@/store/zustand/useCabinUiStore';
import {
  MoodTag,
  NavCategory,
  RecommendationFeed,
  RecommendedMovie,
} from '@/types';

export interface VodRowConfig {
  title: string;
  items: RecommendedMovie[];
  showProgress?: boolean;
  allowViewAll?: boolean;
}

/**
 * Single Responsibility hook combining TanStack Query server state with Zustand Cabin UI store.
 */
export function useVodFeed(
  userId: number,
  activeMood: MoodTag,
  activeCategory: NavCategory
) {
  const queryClient = useQueryClient();
  const {
    data: feed = null,
    isLoading,
    error: queryError,
  } = useRecommendationsQuery(userId, activeMood, activeCategory);

  const focusedMovie = useCabinUiStore((s) => s.focusedMovie);
  const setFocusedMovie = useCabinUiStore((s) => s.setFocusedMovie);
  const actionsVisible = useCabinUiStore((s) => s.actionsVisible);
  const setActionsVisible = useCabinUiStore((s) => s.setActionsVisible);
  const toast = useCabinUiStore((s) => s.toast);
  const showToast = useCabinUiStore((s) => s.showToast);

  useEffect(() => {
    if (!feed) return;
    setFocusedMovie((prev) => {
      if (prev) {
        const updated =
          feed.newForYou.find((m) => m.id === prev.id) ??
          feed.popularSuggestions.find((m) => m.id === prev.id) ??
          feed.continueWatching.find((m) => m.id === prev.id);
        if (updated) return updated;
        if (prev.id > 0) return prev;
      }
      return feed.heroFeatured;
    });
  }, [feed, setFocusedMovie]);

  const syncFeedCache = useCallback(
    (nextFeed: RecommendationFeed) => {
      queryClient.setQueryData(
        vodQueryKeys.recommendations(userId, activeMood, activeCategory),
        nextFeed
      );
      queryClient.invalidateQueries({
        queryKey: vodQueryKeys.recommendationsRoot(),
      });
      queryClient.invalidateQueries({
        queryKey: vodQueryKeys.userProfile(userId),
      });
    },
    [activeCategory, activeMood, queryClient, userId]
  );

  const watchlistMutation = useMutation({
    mutationFn: async (movieId: number) => {
      let targetId = movieId;
      if (targetId < 0 && focusedMovie) {
        const ensured = await ensureMovieInDb(focusedMovie);
        setFocusedMovie(ensured);
        targetId = ensured.id;
      }
      const res = await toggleMyList(userId, targetId);
      return { targetId, ...res };
    },
    onSuccess: ({ targetId, inMyList, feed: nextFeed }) => {
      syncFeedCache(nextFeed);
      setFocusedMovie((prev) =>
        prev && prev.id === targetId ? { ...prev, inMyList } : prev
      );
      showToast(inMyList ? 'ADDED TO MY LIST' : 'REMOVED FROM MY LIST');
    },
    onError: () => {
      showToast('COULD NOT UPDATE MY LIST');
    },
  });

  const ratingMutation = useMutation({
    mutationFn: async ({
      movieId,
      rating,
    }: {
      movieId: number;
      rating: number;
    }) => {
      let targetId = movieId;
      if (targetId < 0 && focusedMovie) {
        const ensured = await ensureMovieInDb(focusedMovie);
        setFocusedMovie(ensured);
        targetId = ensured.id;
      }
      const res = await submitRating(userId, targetId, rating);
      return { targetId, rating, feed: res.feed };
    },
    onSuccess: ({ targetId, rating, feed: nextFeed }) => {
      syncFeedCache(nextFeed);
      setFocusedMovie((prev) =>
        prev && prev.id === targetId ? { ...prev, userRating: rating } : prev
      );
      showToast(`RATED ${rating}★ — RECOMMENDATIONS RE-RANKED`);
    },
    onError: () => {
      showToast('FAILED TO SAVE RATING');
    },
  });

  const progressMutation = useMutation({
    mutationFn: async (vars: {
      movieId: number;
      progressSeconds: number;
      durationSeconds: number;
      season: number;
      episode: number;
    }) => {
      if (vars.movieId < 0) return null;
      return saveWatchProgress(
        userId,
        vars.movieId,
        vars.progressSeconds,
        vars.durationSeconds,
        vars.season,
        vars.episode
      );
    },
    onSuccess: (res) => {
      if (res?.feed) {
        syncFeedCache(res.feed);
      }
    },
  });

  const activeRows = useMemo<VodRowConfig[]>(() => {
    if (!feed) return [];
    const rows: VodRowConfig[] = [
      {
        title: 'NEW FOR YOU',
        items: feed.newForYou.slice(0, 8),
        allowViewAll: true,
      },
      {
        title: 'POPULAR SUGGESTIONS FOR YOU',
        items: feed.popularSuggestions.slice(0, 8),
      },
    ];
    if (feed.continueWatching.length > 0) {
      rows.push({
        title: 'CONTINUE WATCHING',
        items: feed.continueWatching.slice(0, 8),
        showProgress: true,
      });
    }
    if (feed.becauseYouWatched && feed.becauseYouWatched.items.length > 0) {
      rows.push({
        title: `BECAUSE YOU LIKED ${feed.becauseYouWatched.anchorTitle}`,
        items: feed.becauseYouWatched.items.slice(0, 8),
      });
    }
    if (feed.myList.length > 0) {
      rows.push({
        title: 'MY LIST',
        items: feed.myList.slice(0, 8),
      });
    }
    return rows;
  }, [feed]);

  const handleSelectMovie = useCallback(
    async (movie: RecommendedMovie) => {
      const ensured = movie.id < 0 ? await ensureMovieInDb(movie) : movie;
      setFocusedMovie(ensured);
      setActionsVisible(true);
    },
    [setActionsVisible, setFocusedMovie]
  );

  const handleToggleMyList = useCallback(
    async (movieId: number) => {
      await watchlistMutation.mutateAsync(movieId).catch(() => null);
    },
    [watchlistMutation]
  );

  const handleRate = useCallback(
    async (movieId: number, rating: number) => {
      await ratingMutation.mutateAsync({ movieId, rating }).catch(() => null);
    },
    [ratingMutation]
  );

  const handleProgressSync = useCallback(
    async (
      movieId: number,
      progressSeconds: number,
      durationSeconds: number,
      season: number,
      episode: number
    ) => {
      await progressMutation
        .mutateAsync({
          movieId,
          progressSeconds,
          durationSeconds,
          season,
          episode,
        })
        .catch(() => null);
    },
    [progressMutation]
  );

  return {
    feed,
    loading: isLoading && !feed,
    error: queryError instanceof Error ? queryError.message : null,
    focusedMovie,
    setFocusedMovie,
    actionsVisible,
    setActionsVisible,
    activeRows,
    toast,
    handleSelectMovie,
    handleToggleMyList,
    handleRate,
    handleProgressSync,
  };
}
