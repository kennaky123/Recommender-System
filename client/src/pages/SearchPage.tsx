import React, { useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  SearchFiltersState,
  SearchOverlay,
} from '../components/SearchOverlay';
import { useVodShell } from '../context/VodShellContext';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    q?: string;
    genre?: string;
    mediaType?: 'all' | 'movie' | 'tv';
  };

  const { navigateToMovie, navigateToCategory } = useVodShell();

  const handleFiltersChange = useCallback(
    (next: SearchFiltersState) => {
      navigate({
        to: '/search',
        replace: true,
        search: next,
      });
    },
    [navigate]
  );

  return (
    <SearchOverlay
      initialQuery={search.q ?? ''}
      initialGenre={search.genre ?? 'ALL'}
      initialMediaType={search.mediaType ?? 'all'}
      onFiltersChange={handleFiltersChange}
      onSelectMovie={navigateToMovie}
      onClose={() => navigateToCategory('home')}
    />
  );
};
