import React from 'react';
import { ContentRow } from '../components/ContentRow';
import { HeroPreview } from '../components/HeroPreview';
import { MoodFilterBar } from '../components/MoodFilterBar';
import { useVodShell } from '../context/VodShellContext';

interface ChannelPageProps {
  channel: 'live' | 'audio';
}

export const ChannelPage: React.FC<ChannelPageProps> = ({ channel }) => {
  const {
    feed,
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

  const currentHero = focusedMovie ?? feed?.heroFeatured;

  return (
    <>
      <div className="pl-20 lg:pl-24 pr-8 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#F0EA75]/60 bg-[#F0EA75]/10 text-[#F0EA75] text-[11px] font-bold uppercase tracking-wider rounded-[2px]">
          {channel === 'live'
            ? 'STARSHIP SATELLITE LIVE FEED READY — SELECT TITLE BELOW'
            : 'CABIN SPATIAL AUDIO STREAM — CURATED SOUNDTRACK CATALOG'}
        </div>
      </div>

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

      <MoodFilterBar activeMood={activeMood} onSelectMood={setActiveMood} />

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
