import React from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  CatalogFilterState,
  FullCatalogGrid,
} from '../components/FullCatalogGrid';
import { HeroPreview } from '../components/HeroPreview';
import { MoodFilterBar } from '../components/MoodFilterBar';
import { useVodShell } from '../context/VodShellContext';
import { CatalogSort, MoodTag } from '../types';

interface CatalogPageProps {
  category: 'films' | 'shows';
}

export const CatalogPage: React.FC<CatalogPageProps> = ({ category }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    page?: number;
    genre?: string;
    sort?: CatalogSort;
    mood?: MoodTag;
    source?: 'auto' | 'tmdb';
  };

  const {
    feed,
    focusedMovie,
    setFocusedMovie,
    actionsVisible,
    activeMood,
    setActiveMood,
    selectedDevice,
    setSelectedDevice,
    handleSelectMovie,
    handleToggleMyList,
    handleRate,
    launchPlayer,
    navigateToMovie,
    navigateToSeries,
  } = useVodShell();

  const page = search.page ?? 1;
  const genre = search.genre ?? 'ALL';
  const sort: CatalogSort = search.sort ?? 'popular';
  const mood: MoodTag = search.mood ?? activeMood;
  const source: 'auto' | 'tmdb' = search.source ?? 'auto';

  const currentHero = focusedMovie ?? feed?.heroFeatured;
  const targetPath = category === 'shows' ? '/shows' : '/films';

  const handleFilterChange = (next: CatalogFilterState) => {
    navigate({
      to: targetPath,
      search: {
        page: next.page,
        genre: next.genre,
        sort: next.sort,
        mood,
        source: next.source,
      },
    });
  };

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
        activeMood={mood}
        onSelectMood={(nextMood) => {
          setActiveMood(nextMood);
          navigate({
            to: targetPath,
            search: {
              page: 1,
              genre,
              sort,
              mood: nextMood,
              source,
            },
          });
        }}
      />

      <FullCatalogGrid
        category={category}
        activeMood={mood}
        focusedId={focusedMovie?.id ?? null}
        tmdbEnabled={feed?.tmdbEnabled ?? false}
        genre={genre}
        sort={sort}
        page={page}
        source={source}
        onChangeFilters={handleFilterChange}
        onFocusItem={setFocusedMovie}
        onSelectItem={navigateToMovie}
      />
    </>
  );
};
