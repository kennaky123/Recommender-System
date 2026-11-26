import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ensureMovieInDb,
  fetchRecommendations,
  saveWatchProgress,
  submitRating,
  toggleMyList,
} from './api';
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
import {
  Episode,
  MoodTag,
  NavCategory,
  PlaybackDevice,
  RecommendationFeed,
  RecommendedMovie,
} from './types';

export function App() {
  const [feed, setFeed] = useState<RecommendationFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<NavCategory>('home');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeMood, setActiveMood] = useState<MoodTag>('all');
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] =
    useState<PlaybackDevice>('CABIN DISPLAY 8K');

  const [focusedMovie, setFocusedMovie] = useState<RecommendedMovie | null>(null);
  const [actionsVisible, setActionsVisible] = useState(true);
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

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadFeed = useCallback(
    async (mood: MoodTag, category: NavCategory) => {
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
    },
    []
  );

  useEffect(() => {
    loadFeed(activeMood, activeCategory);
  }, [activeMood, activeCategory, loadFeed]);

  // Dashboard (HOME) stays strictly limited to 8 items per row
  const activeRows = useMemo(() => {
    if (!feed) return [];
    const rows: Array<{
      title: string;
      items: RecommendedMovie[];
      showProgress?: boolean;
      allowViewAll?: boolean;
    }> = [
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

  const handleDpadNavigate = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') => {
      if (dir === 'back') {
        if (playerState) {
          setPlayerState(null);
        } else if (seriesDetailMovie) {
          setSeriesDetailMovie(null);
          setFocusedEpisode(null);
        } else if (sidebarExpanded) {
          setSidebarExpanded(false);
        } else if (activeCategory !== 'home') {
          setActiveCategory('home');
        }
        return;
      }

      if (dir === 'ok' && focusedMovie) {
        setPlayerState({
          movie: focusedMovie,
          mode: 'watch',
          season: focusedMovie.lastSeason ?? 1,
          episode: focusedMovie.lastEpisode ?? 1,
        });
        return;
      }

      if (activeRows.length === 0 || !focusedMovie) return;
      let rIdx = activeRows.findIndex((r) =>
        r.items.some((i) => i.id === focusedMovie.id)
      );
      if (rIdx < 0) rIdx = 0;
      let cIdx = activeRows[rIdx].items.findIndex((i) => i.id === focusedMovie.id);
      if (cIdx < 0) cIdx = 0;

      if (dir === 'left') {
        if (cIdx === 0) {
          setSidebarExpanded(true);
        } else {
          setSidebarExpanded(false);
          setFocusedMovie(activeRows[rIdx].items[cIdx - 1]);
        }
      } else if (dir === 'right') {
        setSidebarExpanded(false);
        const nextC = Math.min(activeRows[rIdx].items.length - 1, cIdx + 1);
        setFocusedMovie(activeRows[rIdx].items[nextC]);
      } else if (dir === 'down') {
        const nextR = Math.min(activeRows.length - 1, rIdx + 1);
        const targetCol = Math.min(activeRows[nextR].items.length - 1, cIdx);
        setFocusedMovie(activeRows[nextR].items[targetCol]);
      } else if (dir === 'up') {
        const prevR = Math.max(0, rIdx - 1);
        const targetCol = Math.min(activeRows[prevR].items.length - 1, cIdx);
        setFocusedMovie(activeRows[prevR].items[targetCol]);
      }
    },
    [
      activeCategory,
      activeRows,
      focusedMovie,
      playerState,
      seriesDetailMovie,
      sidebarExpanded,
    ]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleDpadNavigate('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleDpadNavigate('right');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleDpadNavigate('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleDpadNavigate('down');
      } else if (e.key === 'Escape') {
        handleDpadNavigate('back');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDpadNavigate]);

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
                onTrailer={async (m) => {
                  const ensured = m.id < 0 ? await ensureMovieInDb(m) : m;
                  setPlayerState({
                    movie: ensured,
                    mode: 'trailer',
                    season: 1,
                    episode: 1,
                  });
                }}
                onWatch={async (m) => {
                  const ensured = m.id < 0 ? await ensureMovieInDb(m) : m;
                  setPlayerState({
                    movie: ensured,
                    mode: 'watch',
                    season: focusedEpisode?.season ?? ensured.lastSeason ?? 1,
                    episode: focusedEpisode?.episode ?? ensured.lastEpisode ?? 1,
                  });
                }}
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
                  setPlayerState({
                    movie: seriesDetailMovie,
                    mode: 'watch',
                    season: ep.season,
                    episode: ep.episode,
                  })
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
