import React from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { LeftSidebar } from './components/LeftSidebar';
import { MobileRemoteDrawer } from './components/MobileRemoteDrawer';
import { TelemetryHeader } from './components/TelemetryHeader';
import { VidLinkPlayerModal } from './components/VidLinkPlayerModal';
import { useVodShell, VodShellProvider } from './context/VodShellContext';
import { CatalogPage } from './pages/CatalogPage';
import { ChannelPage } from './pages/ChannelPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SearchPage } from './pages/SearchPage';
import { SeriesDetailPage } from './pages/SeriesDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { CatalogSort, MoodTag } from './types';

const VALID_MOODS: MoodTag[] = [
  'all',
  'dramatic',
  'intense',
  'fun',
  'calm',
  'mind-bending',
  'epic',
];

const VALID_SORTS: CatalogSort[] = ['popular', 'newest', 'title'];

function parseMood(raw: unknown): MoodTag | undefined {
  return VALID_MOODS.includes(raw as MoodTag) ? (raw as MoodTag) : undefined;
}

function validateCatalogSearch(search: Record<string, unknown>) {
  const page = Number(search.page);
  const sort = VALID_SORTS.includes(search.sort as CatalogSort)
    ? (search.sort as CatalogSort)
    : 'popular';
  const mood = parseMood(search.mood) ?? 'all';
  const source: 'auto' | 'tmdb' = search.source === 'tmdb' ? 'tmdb' : 'auto';
  return {
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    genre: typeof search.genre === 'string' && search.genre ? search.genre : 'ALL',
    sort,
    mood,
    source,
  };
}

const ShellFrame: React.FC = () => {
  const {
    activeCategory,
    navigateToCategory,
    feed,
    focusedMovie,
    toast,
    sidebarExpanded,
    setSidebarExpanded,
    remoteOpen,
    setRemoteOpen,
    selectedDevice,
    playerState,
    closePlayer,
    handleToggleMyList,
    handleProgressSync,
    handleDpadNavigate,
  } = useVodShell();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-[#0F1429] via-[#101831] to-[#131A35] text-white">
      <TelemetryHeader
        dimBrand={sidebarExpanded}
        storageMode={feed?.storageMode ?? 'memory-fallback'}
        remoteOpen={remoteOpen}
        onToggleRemote={() => setRemoteOpen((v) => !v)}
      />

      <LeftSidebar
        activeCategory={activeCategory}
        expanded={sidebarExpanded}
        onExpandChange={setSidebarExpanded}
        onSelectCategory={navigateToCategory}
        userName="CLAUDE PATTERSON"
        avatarUrl="/backdrops/claude-patterson.jpg"
      />

      <main className="flex-1 relative pb-10">
        <Outlet />
      </main>

      <MobileRemoteDrawer
        open={remoteOpen}
        activeCategory={activeCategory}
        onClose={() => setRemoteOpen(false)}
        onNavigate={handleDpadNavigate}
        onSelectCategory={navigateToCategory}
        onToggleMyList={() => {
          if (focusedMovie) handleToggleMyList(focusedMovie.id);
        }}
      />

      {playerState && (
        <VidLinkPlayerModal
          movie={playerState.movie}
          mode={playerState.mode}
          season={playerState.season}
          episode={playerState.episode}
          device={selectedDevice}
          onClose={closePlayer}
          onProgressSync={handleProgressSync}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#060914] border border-[#F0EA75] text-[#F0EA75] text-[11px] font-bold uppercase tracking-[0.1em] rounded-[3px] shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
};

const RootLayout: React.FC = () => (
  <VodShellProvider>
    <ShellFrame />
  </VodShellProvider>
);

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): { mood?: MoodTag } => {
    const mood = parseMood(search.mood);
    return mood ? { mood } : {};
  },
  component: HomePage,
});

const filmsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/films',
  validateSearch: validateCatalogSearch,
  component: () => <CatalogPage category="films" />,
});

const showsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shows',
  validateSearch: validateCatalogSearch,
  component: () => <CatalogPage category="shows" />,
});

const seriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/series/$movieId',
  validateSearch: (search: Record<string, unknown>): { season: number } => {
    const season = Number(search.season);
    return {
      season: Number.isFinite(season) && season >= 1 ? Math.floor(season) : 1,
    };
  },
  component: SeriesDetailPage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (
    search: Record<string, unknown>
  ): { q: string; genre: string; mediaType: 'all' | 'movie' | 'tv' } => {
    const mt =
      search.mediaType === 'movie' || search.mediaType === 'tv'
        ? search.mediaType
        : 'all';
    return {
      q: typeof search.q === 'string' ? search.q : '',
      genre: typeof search.genre === 'string' && search.genre ? search.genre : 'ALL',
      mediaType: mt,
    };
  },
  component: SearchPage,
});

const liveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/live',
  component: () => <ChannelPage channel="live" />,
});

const audioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/audio',
  component: () => <ChannelPage channel="audio" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  filmsRoute,
  showsRoute,
  seriesRoute,
  searchRoute,
  liveRoute,
  audioRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
