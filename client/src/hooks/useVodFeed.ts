import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ensureMovieInDb,
  fetchRecommendations,
  saveWatchProgress,
  submitRating,
  toggleMyList,
} from '../api';
import {
  MoodTag,
  NavCategory,
  RecommendationFeed,
  RecommendedMovie,
} from '../types';

export interface VodRowConfig {
  title: string;
  items: RecommendedMovie[];
  showProgress?: boolean;
  allowViewAll?: boolean;
}

/**
 * Single Responsibility hook: manages recommendation feed fetching, selection,
 * ratings, My List mutations, watch-progress sync, and transient notifications.
 */
export function useVodFeed(activeMood: MoodTag, activeCategory: NavCategory) {
  const [feed, setFeed] = useState<RecommendationFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedMovie, setFocusedMovie] = useState<RecommendedMovie | null>(null);
  const [actionsVisible, setActionsVisible] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadFeed = useCallback(async (mood: MoodTag, category: NavCategory) => {
    try {
      setLoading(true);
      const data = await fetchRecommendations(mood, category);
      setFeed(data);
      setFocusedMovie((prev) => {
        if (prev) {
          const updated =
            data.newForYou.find((m) => m.id === prev.id) ??
            data.popularSuggestions.find((m) => m.id === prev.id) ??
            data.continueWatching.find((m) => m.id === prev.id);
          if (updated) return updated;
          if (prev.id > 0) return prev;
        }
        return data.heroFeatured;
      });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(activeMood, activeCategory);
  }, [activeMood, activeCategory, loadFeed]);

  // Dashboard (HOME) stays capped at 8 items per horizontal row
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

  const handleSelectMovie = useCallback(async (movie: RecommendedMovie) => {
    const ensured = movie.id < 0 ? await ensureMovieInDb(movie) : movie;
    setFocusedMovie(ensured);
    setActionsVisible(true);
  }, []);

  const handleToggleMyList = useCallback(
    async (movieId: number) => {
      try {
        let targetId = movieId;
        if (targetId < 0 && focusedMovie) {
          const ensured = await ensureMovieInDb(focusedMovie);
          setFocusedMovie(ensured);
          targetId = ensured.id;
        }
        const res = await toggleMyList(targetId);
        setFeed(res.feed);
        setFocusedMovie((prev) =>
          prev && prev.id === targetId ? { ...prev, inMyList: res.inMyList } : prev
        );
        showToast(res.inMyList ? 'ADDED TO MY LIST' : 'REMOVED FROM MY LIST');
      } catch {
        showToast('COULD NOT UPDATE MY LIST');
      }
    },
    [focusedMovie, showToast]
  );

  const handleRate = useCallback(
    async (movieId: number, rating: number) => {
      try {
        let targetId = movieId;
        if (targetId < 0 && focusedMovie) {
          const ensured = await ensureMovieInDb(focusedMovie);
          setFocusedMovie(ensured);
          targetId = ensured.id;
        }
        const res = await submitRating(targetId, rating);
        setFeed(res.feed);
        setFocusedMovie((prev) =>
          prev && prev.id === targetId ? { ...prev, userRating: rating } : prev
        );
        showToast(`RATED ${rating}★ — RECOMMENDATIONS RE-RANKED`);
      } catch {
        showToast('FAILED TO SAVE RATING');
      }
    },
    [focusedMovie, showToast]
  );

  const handleProgressSync = useCallback(
    async (
      movieId: number,
      progressSeconds: number,
      durationSeconds: number,
      season: number,
      episode: number
    ) => {
      try {
        if (movieId < 0) return;
        const res = await saveWatchProgress(
          movieId,
          progressSeconds,
          durationSeconds,
          season,
          episode
        );
        setFeed(res.feed);
      } catch {
        // silent background sync
      }
    },
    []
  );

  return {
    feed,
    loading,
    error,
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
