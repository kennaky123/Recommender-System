import React, { useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ContentRow } from '../components/ContentRow';
import { HeroPreview } from '../components/HeroPreview';
import { MoodFilterBar } from '../components/MoodFilterBar';
import { useVodShell } from '../context/VodShellContext';
import { MoodTag } from '../types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { mood?: MoodTag };

  const {
    feed,
    loading,
    error,
    focusedMovie,
    setFocusedMovie,
    actionsVisible,
    activeRows,
    activeMood,
    setActiveMood,
    selectedDevice,
    setSelectedDevice,
    handleSelectMovie,
    handleToggleMyList,
    handleRate,
    launchPlayer,
    navigateToCategory,
    navigateToSeries,
  } = useVodShell();

  useEffect(() => {
    if (search.mood && search.mood !== activeMood) {
      setActiveMood(search.mood);
    }
  }, [search.mood, activeMood, setActiveMood]);

  if (loading && !feed) {
    return (
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
    );
  }

  if (error && !feed) {
    return (
      <div className="pl-24 pr-10 pt-16">
        <div className="border border-[#87899D] bg-[#0B1023] p-6 rounded-[4px] max-w-lg">
          <h2 className="text-[16px] font-bold uppercase text-white">
            TELEMETRY LINK ERROR
          </h2>
          <p className="text-[13px] text-[#C8D0E0] mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const currentHero = focusedMovie ?? feed?.heroFeatured;

  return (
    <>
      {currentHero && (
        <HeroPreview
          movie={currentHero}
          showActions={actionsVisible}
          selectedDevice={selectedDevice}
          onSelectDevice={setSelectedDevice}
          onTrailer={(m) => launchPlayer(m, 'trailer', 1, 1)}
          onWatch={(m) => launchPlayer(m, 'watch')}
          onToggleMyList={handleToggleMyList}
          onRate={handleRate}
          onOpenEpisodes={
            currentHero.mediaType === 'tv'
              ? (m) => navigateToSeries(m)
              : undefined
          }
        />
      )}

      <MoodFilterBar
        activeMood={activeMood}
        onSelectMood={(mood) => {
          setActiveMood(mood);
          navigate({
            to: '/',
            search: mood !== 'all' ? { mood } : {},
          });
        }}
      />

      {activeRows.map((row) => (
        <ContentRow
          key={row.title}
          title={row.title}
          items={row.items}
          focusedId={focusedMovie?.id ?? null}
          showProgress={row.showProgress}
          onFocusItem={setFocusedMovie}
          onSelectItem={handleSelectMovie}
          onViewAll={
            row.allowViewAll ? () => navigateToCategory('films') : undefined
          }
          viewAllLabel={
            row.allowViewAll && feed
              ? `BROWSE FULL CATALOG (${feed.engineStats.totalMovies.toLocaleString()})`
              : undefined
          }
        />
      ))}
    </>
  );
};
