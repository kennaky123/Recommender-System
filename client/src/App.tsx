import { useCallback, useState } from 'react';
import { ensureMovieInDb } from './api';
import { ContentRow } from './components/ContentRow';
import { FullCatalogGrid } from './components/FullCatalogGrid';
import { HeroPreview } from './components/HeroPreview';
import { LeftSidebar } from './components/LeftSidebar';
import { MobileRemoteDrawer } from './components/MobileRemoteDrawer';
import { MoodFilterBar } from './components/MoodFilterBar';
import { SearchOverlay } from './components/SearchOverlay';
import { SeriesEpisodesPanel } from './components/SeriesEpisodesPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { TelemetryHeader } from './components/TelemetryHeader';
import { VidLinkPlayerModal } from './components/VidLinkPlayerModal';
import { useDpadNavigation } from './hooks/useDpadNavigation';
import { useVodFeed } from './hooks/useVodFeed';
import {
  Episode,
  MoodTag,
  NavCategory,
  PlaybackDevice,
  RecommendedMovie,
} from './types';

export function App() {
  const [activeCategory, setActiveCategory] = useState<NavCategory>('home');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeMood, setActiveMood] = useState<MoodTag>('all');
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] =
    useState<PlaybackDevice>('CABIN DISPLAY 8K');

  const [seriesDetailMovie, setSeriesDetailMovie] =
    useState<RecommendedMovie | null>(null);
  const [activeSeason, setActiveSeason] = useState(1);
  const [focusedEpisode, setFocusedEpisode] = useState<Episode | null>(null);

  const [playerState, setPlayerState] = useState<{
    movie: RecommendedMovie;
    mode: 'watch' | 'trailer';
    season: number;
    episode: number;
  } | null>(null);

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
  } = useVodFeed(activeMood, activeCategory);

  const handleOpenEpisodes = useCallback((movie: RecommendedMovie) => {
    setSeriesDetailMovie(movie);
    const s = movie.lastSeason ?? 1;
    setActiveSeason(s);
    const firstEp =
      (movie.episodes ?? []).find((ep) => ep.season === s) ??
      movie.episodes?.[0] ??
      null;
    setFocusedEpisode(firstEp);
  }, []);

  const launchPlayer = useCallback(
    async (
      movie: RecommendedMovie,
      mode: 'watch' | 'trailer',
      seasonOverride?: number,
      episodeOverride?: number
    ) => {
      const ensured = movie.id < 0 ? await ensureMovieInDb(movie) : movie;
      setPlayerState({
        movie: ensured,
        mode,
        season:
          seasonOverride ?? focusedEpisode?.season ?? ensured.lastSeason ?? 1,
        episode:
          episodeOverride ?? focusedEpisode?.episode ?? ensured.lastEpisode ?? 1,
      });
    },
    [focusedEpisode]
  );

  const { handleDpadNavigate } = useDpadNavigation({
    activeCategory,
    activeRows,
    focusedMovie,
    sidebarExpanded,
    isPlayerOpen: Boolean(playerState),
    isSeriesOpen: Boolean(seriesDetailMovie),
    onFocusMovie: setFocusedMovie,
    onExpandSidebar: setSidebarExpanded,
    onClosePlayer: () => setPlayerState(null),
    onCloseSeries: () => {
      setSeriesDetailMovie(null);
      setFocusedEpisode(null);
    },
    onResetToHome: () => setActiveCategory('home'),
    onLaunchWatch: (m) => launchPlayer(m, 'watch'),
  });

  const currentHero = seriesDetailMovie ?? focusedMovie ?? feed?.heroFeatured;
  const isFullCatalogView = activeCategory === 'films' || activeCategory === 'shows';

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
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          setSeriesDetailMovie(null);
          setFocusedEpisode(null);
        }}
        userName="CLAUDE PATTERSON"
        avatarUrl="/backdrops/claude-patterson.jpg"
      />

      <main className="flex-1 relative pb-10">
        {loading && !feed ? (
          <div className="pl-24 pr-10 pt-16 space-y-6">
            <div className="h-64 w-full max-w-2xl bg-[#131A35] rounded-[6px] animate-pulse" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-video bg-[#131A35] rounded-[6px] animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : error && !feed ? (
          <div className="pl-24 pr-10 pt-16">
            <div className="border border-[#87899D] bg-[#0B1023] p-6 rounded-[4px] max-w-lg">
              <h2 className="text-[16px] font-bold uppercase text-white">
                TELEMETRY LINK ERROR
              </h2>
              <p className="text-[13px] text-[#C8D0E0] mt-1">{error}</p>
            </div>
          </div>
        ) : activeCategory === 'search' ? (
          <SearchOverlay
            onSelectMovie={(m) => {
              setFocusedMovie(m);
              setActionsVisible(true);
              setActiveCategory('home');
            }}
            onClose={() => setActiveCategory('home')}
          />
        ) : activeCategory === 'settings' && feed ? (
          <SettingsPanel feed={feed} onClose={() => setActiveCategory('home')} />
        ) : (
          <>
            {(activeCategory === 'live' || activeCategory === 'audio') && (
              <div className="pl-20 lg:pl-24 pr-8 pt-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#F0EA75]/60 bg-[#F0EA75]/10 text-[#F0EA75] text-[11px] font-bold uppercase tracking-wider rounded-[2px]">
                  {activeCategory === 'live'
                    ? 'STARSHIP SATELLITE LIVE FEED READY — SELECT TITLE BELOW'
                    : 'CABIN SPATIAL AUDIO STREAM — CURATED SOUNDTRACK CATALOG'}
                </div>
              </div>
            )}

            {currentHero && (
              <HeroPreview
                movie={currentHero}
                showActions={actionsVisible}
                selectedDevice={selectedDevice}
                onSelectDevice={setSelectedDevice}
                episodePrefix={
                  seriesDetailMovie && focusedEpisode
                    ? `S${focusedEpisode.season} EP${focusedEpisode.episode}:`
                    : undefined
                }
                onTrailer={(m) => launchPlayer(m, 'trailer', 1, 1)}
                onWatch={(m) => launchPlayer(m, 'watch')}
                onToggleMyList={handleToggleMyList}
                onRate={handleRate}
                onOpenEpisodes={
                  currentHero.mediaType === 'tv' && !seriesDetailMovie
                    ? handleOpenEpisodes
                    : undefined
                }
              />
            )}

            {seriesDetailMovie ? (
              <SeriesEpisodesPanel
                movie={seriesDetailMovie}
                activeSeason={activeSeason}
                focusedEpisode={focusedEpisode}
                onSelectSeason={(s) => {
                  setActiveSeason(s);
                  const first = (seriesDetailMovie.episodes ?? []).find(
                    (ep) => ep.season === s
                  );
                  setFocusedEpisode(first ?? null);
                }}
                onFocusEpisode={setFocusedEpisode}
                onPlayEpisode={(ep) =>
                  launchPlayer(seriesDetailMovie, 'watch', ep.season, ep.episode)
                }
                onBack={() => {
                  setSeriesDetailMovie(null);
                  setFocusedEpisode(null);
                }}
              />
            ) : (
              <>
                <MoodFilterBar
                  activeMood={activeMood}
                  onSelectMood={setActiveMood}
                />

                {isFullCatalogView ? (
                  <FullCatalogGrid
                    category={activeCategory === 'shows' ? 'shows' : 'films'}
                    activeMood={activeMood}
                    focusedId={focusedMovie?.id ?? null}
                    tmdbEnabled={feed?.tmdbEnabled ?? false}
                    onFocusItem={setFocusedMovie}
                    onSelectItem={handleSelectMovie}
                  />
                ) : (
                  activeRows.map((row) => (
                    <ContentRow
                      key={row.title}
                      title={row.title}
                      items={row.items}
                      focusedId={focusedMovie?.id ?? null}
                      showProgress={row.showProgress}
                      onFocusItem={setFocusedMovie}
                      onSelectItem={handleSelectMovie}
                      onViewAll={
                        row.allowViewAll
                          ? () => setActiveCategory('films')
                          : undefined
                      }
                      viewAllLabel={
                        row.allowViewAll && feed
                          ? `BROWSE FULL CATALOG (${feed.engineStats.totalMovies.toLocaleString()})`
                          : undefined
                      }
                    />
                  ))
                )}
              </>
            )}
          </>
        )}
      </main>

      <MobileRemoteDrawer
        open={remoteOpen}
        activeCategory={activeCategory}
        onClose={() => setRemoteOpen(false)}
        onNavigate={handleDpadNavigate}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          setSeriesDetailMovie(null);
        }}
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
          onClose={() => setPlayerState(null)}
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
}

export default App;
