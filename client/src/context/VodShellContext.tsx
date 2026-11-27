import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { ensureMovieInDb } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { DpadDirection, useDpadNavigation } from '@/hooks/useDpadNavigation';
import { useVodFeed, VodRowConfig } from '@/hooks/useVodFeed';
import { useAppDispatch, useAppSelector } from '@/store/redux/hooks';
import {
  setActiveMood as setActiveMoodAction,
  setSelectedDevice as setSelectedDeviceAction,
} from '@/store/redux/preferencesSlice';
import {
  type PlayerModalState,
  useCabinUiStore,
} from '@/store/zustand/useCabinUiStore';
import {
  MoodTag,
  NavCategory,
  PlaybackDevice,
  RecommendationFeed,
  RecommendedMovie,
} from '@/types';

export type { PlayerModalState };

interface VodShellContextValue {
  activeCategory: NavCategory;
  navigateToCategory: (cat: NavCategory) => void;
  navigateToMovie: (movie: RecommendedMovie) => Promise<void>;
  navigateToSeries: (movie: RecommendedMovie, season?: number) => void;
  feed: RecommendationFeed | null;
  loading: boolean;
  error: string | null;
  focusedMovie: RecommendedMovie | null;
  setFocusedMovie: (
    movie:
      | RecommendedMovie
      | null
      | ((prev: RecommendedMovie | null) => RecommendedMovie | null)
  ) => void;
  actionsVisible: boolean;
  setActionsVisible: (visible: boolean) => void;
  activeRows: VodRowConfig[];
  toast: string | null;
  activeMood: MoodTag;
  setActiveMood: (mood: MoodTag) => void;
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  selectedDevice: PlaybackDevice;
  setSelectedDevice: (device: PlaybackDevice) => void;
  playerState: PlayerModalState | null;
  closePlayer: () => void;
  launchPlayer: (
    movie: RecommendedMovie,
    mode: 'watch' | 'trailer',
    season?: number,
    episode?: number
  ) => Promise<void>;
  handleSelectMovie: (movie: RecommendedMovie) => Promise<void>;
  handleToggleMyList: (movieId: number) => Promise<void>;
  handleRate: (movieId: number, rating: number) => Promise<void>;
  handleProgressSync: (
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season: number,
    episode: number
  ) => Promise<void>;
  handleDpadNavigate: (dir: DpadDirection) => void;
}

const VodShellContext = createContext<VodShellContextValue | null>(null);

function deriveCategoryFromPath(pathname: string): NavCategory {
  if (pathname.startsWith('/discover')) return 'discover';
  if (pathname.startsWith('/my-list')) return 'my-list';
  if (pathname.startsWith('/films') || pathname.startsWith('/movie')) {
    return 'films';
  }
  if (pathname.startsWith('/shows') || pathname.startsWith('/series')) {
    return 'shows';
  }
  if (pathname.startsWith('/search')) return 'search';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'home';
}

export const VodShellProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { activeUserId } = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const activeCategory = useMemo(
    () => deriveCategoryFromPath(pathname),
    [pathname]
  );

  // Redux Toolkit preferences state
  const activeMood = useAppSelector((s) => s.preferences.activeMood);
  const selectedDevice = useAppSelector((s) => s.preferences.selectedDevice);
  const setActiveMood = useCallback(
    (mood: MoodTag) => dispatch(setActiveMoodAction(mood)),
    [dispatch]
  );
  const setSelectedDevice = useCallback(
    (device: PlaybackDevice) => dispatch(setSelectedDeviceAction(device)),
    [dispatch]
  );

  // Zustand Cabin UI state
  const sidebarExpanded = useCabinUiStore((s) => s.sidebarExpanded);
  const setSidebarExpanded = useCabinUiStore((s) => s.setSidebarExpanded);
  const playerState = useCabinUiStore((s) => s.playerState);
  const openPlayer = useCabinUiStore((s) => s.openPlayer);
  const closePlayer = useCabinUiStore((s) => s.closePlayer);

  const {
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
  } = useVodFeed(activeUserId, activeMood, activeCategory);

  const navigateToCategory = useCallback(
    (cat: NavCategory) => {
      switch (cat) {
        case 'films':
          navigate({
            to: '/films',
            search: {
              page: 1,
              genre: 'ALL',
              sort: 'popular',
              mood: activeMood,
              source: 'auto',
            },
          });
          break;
        case 'shows':
          navigate({
            to: '/shows',
            search: {
              page: 1,
              genre: 'ALL',
              sort: 'popular',
              mood: activeMood,
              source: 'auto',
            },
          });
          break;
        case 'search':
          navigate({
            to: '/search',
            search: { q: '', genre: 'ALL', mediaType: 'all' },
          });
          break;
        case 'discover':
          navigate({ to: '/discover' });
          break;
        case 'my-list':
          navigate({ to: '/my-list' });
          break;
        case 'settings':
          navigate({ to: '/settings' });
          break;
        case 'home':
        default:
          navigate({
            to: '/',
            search: activeMood !== 'all' ? { mood: activeMood } : {},
          });
          break;
      }
    },
    [activeMood, navigate]
  );

  const navigateToSeries = useCallback(
    (movie: RecommendedMovie, season?: number) => {
      setFocusedMovie(movie);
      navigate({
        to: '/series/$movieId',
        params: { movieId: String(movie.id) },
        search: { season: season ?? movie.lastSeason ?? 1 },
      });
    },
    [navigate, setFocusedMovie]
  );

  const navigateToMovie = useCallback(
    async (movie: RecommendedMovie) => {
      const ensured = movie.id < 0 ? await ensureMovieInDb(movie) : movie;
      setFocusedMovie(ensured);
      setActionsVisible(true);
      if (ensured.mediaType === 'tv') {
        navigate({
          to: '/series/$movieId',
          params: { movieId: String(ensured.id) },
          search: { season: ensured.lastSeason ?? 1 },
        });
        return;
      }
      navigate({
        to: '/movie/$movieId',
        params: { movieId: String(ensured.id) },
      });
    },
    [navigate, setFocusedMovie, setActionsVisible]
  );

  const launchPlayer = useCallback(
    async (
      movie: RecommendedMovie,
      mode: 'watch' | 'trailer',
      season = 1,
      episode = 1
    ) => {
      const ensured = movie.id < 0 ? await ensureMovieInDb(movie) : movie;
      openPlayer({
        movie: ensured,
        mode,
        season: season || ensured.lastSeason || 1,
        episode: episode || ensured.lastEpisode || 1,
      });
    },
    [openPlayer]
  );

  const isSeriesOpen = pathname.startsWith('/series');

  const { handleDpadNavigate } = useDpadNavigation({
    activeCategory,
    activeRows,
    focusedMovie,
    sidebarExpanded,
    isPlayerOpen: Boolean(playerState),
    isSeriesOpen,
    onFocusMovie: setFocusedMovie,
    onExpandSidebar: setSidebarExpanded,
    onClosePlayer: closePlayer,
    onCloseSeries: () => navigateToCategory('home'),
    onResetToHome: () => navigateToCategory('home'),
    onLaunchWatch: (m) => launchPlayer(m, 'watch'),
  });

  const value: VodShellContextValue = {
    activeCategory,
    navigateToCategory,
    navigateToMovie,
    navigateToSeries,
    feed,
    loading,
    error,
    focusedMovie,
    setFocusedMovie,
    actionsVisible,
    setActionsVisible,
    activeRows,
    toast,
    activeMood,
    setActiveMood,
    sidebarExpanded,
    setSidebarExpanded,
    selectedDevice,
    setSelectedDevice,
    playerState,
    closePlayer,
    launchPlayer,
    handleSelectMovie,
    handleToggleMyList,
    handleRate,
    handleProgressSync,
    handleDpadNavigate,
  };

  return (
    <VodShellContext.Provider value={value}>{children}</VodShellContext.Provider>
  );
};

export function useVodShell(): VodShellContextValue {
  const ctx = useContext(VodShellContext);
  if (!ctx) {
    throw new Error('useVodShell must be used inside VodShellProvider');
  }
  return ctx;
}
