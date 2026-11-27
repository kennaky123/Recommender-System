import React, { useEffect, useState } from 'react';
import { MagnifyingGlass, X, Database, Globe } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchCatalogInfiniteQuery } from '@/hooks/useVodQueries';
import { ensureMovieInDb } from '../api';
import { RecommendedMovie } from '../types';
import { ProviderLogo } from './ProviderLogo';

export interface SearchFiltersState {
  q: string;
  genre: string;
  mediaType: 'all' | 'movie' | 'tv';
}

interface SearchOverlayProps {
  initialQuery?: string;
  initialGenre?: string;
  initialMediaType?: 'all' | 'movie' | 'tv';
  onFiltersChange?: (next: SearchFiltersState) => void;
  onSelectMovie: (movie: RecommendedMovie) => void;
  onClose: () => void;
}

const GENRES = [
  'ALL',
  'SCI-FI',
  'ACTION',
  'DRAMA',
  'ADVENTURE',
  'COMEDY',
  'ANIMATION',
  'THRILLER',
  'HORROR',
  'ROMANCE',
];

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  initialQuery = '',
  initialGenre = 'ALL',
  initialMediaType = 'all',
  onFiltersChange,
  onSelectMovie,
  onClose,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [genre, setGenre] = useState(initialGenre);
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>(
    initialMediaType
  );

  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery);
    setGenre(initialGenre);
    setMediaType(initialMediaType);
  }, [initialQuery, initialGenre, initialMediaType]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      onFiltersChange?.({ q: query, genre, mediaType });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, genre, mediaType, onFiltersChange]);

  const {
    data,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearchCatalogInfiniteQuery({
    q: debouncedQuery,
    genre,
    mediaType,
  });

  const results = data?.pages.flatMap((p) => p.movies) ?? [];
  const latestPage = data?.pages[data.pages.length - 1];
  const total = latestPage?.total ?? 0;
  const totalPages = latestPage?.totalPages ?? 1;
  const currentPage = latestPage?.page ?? 1;
  const sourcesUsed = latestPage?.sourcesUsed ?? [];
  const tmdbEnabled = latestPage?.tmdbEnabled ?? false;

  const handlePickMovie = async (movie: RecommendedMovie) => {
    const ensured = movie.id < 0 ? await ensureMovieInDb(movie) : movie;
    onSelectMovie(ensured);
  };

  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 py-8 min-h-[calc(100dvh-66px)]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[22px] font-bold uppercase tracking-[0.06em] text-white">
            SEARCH FULL API CATALOG
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] uppercase tracking-[0.08em] text-[#87899D]">
            <span className="tabular-nums text-[#F0EA75] font-bold">
              {total.toLocaleString()} MATCHING TITLES
            </span>
            {sourcesUsed.map((s) => (
              <Badge key={s} variant="secondary">
                {s.includes('TMDB') ? <Globe size={11} /> : <Database size={11} />}
                {s}
              </Badge>
            ))}
            {!tmdbEnabled && (
              <span className="text-[#87899D]">
                (ADD <code className="text-white">TMDB_API_KEY</code> IN{' '}
                <code className="text-white">server/.env</code> TO ALSO SEARCH ALL LIVE TMDB)
              </span>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onClose}
        >
          <X size={14} weight="bold" />
          <span>BACK TO HOME</span>
        </Button>
      </div>

      {/* Search Input + Media Type Switch */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[260px] max-w-2xl">
          <MagnifyingGlass
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#87899D]"
          />
          <Input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all 9,700+ MovieLens & TMDB titles (e.g. Matrix, Toy Story, Interstellar, Avatar)..."
            className="pl-11"
          />
        </div>

        <div className="flex items-center border border-[#373B47] rounded-[3px] overflow-hidden">
          {(['all', 'movie', 'tv'] as const).map((mt) => (
            <button
              key={mt}
              type="button"
              onClick={() => setMediaType(mt)}
              className={`h-12 px-4 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                mediaType === mt
                  ? 'bg-white text-[#0F1429]'
                  : 'bg-[#060914] text-[#B8C0D4] hover:text-white'
              }`}
            >
              {mt === 'all' ? 'ALL' : mt === 'movie' ? 'FILMS' : 'TV SHOWS'}
            </button>
          ))}
        </div>
      </div>

      {/* Genre Pills */}
      <div className="flex flex-wrap items-center gap-2 mb-7">
        {GENRES.map((g) => (
          <Button
            key={g}
            type="button"
            variant={genre === g ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setGenre(g)}
            className="h-7 rounded-[2px]"
          >
            {g}
          </Button>
        ))}
      </div>

      {/* Results Grid */}
      {isPending ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card className="p-8 max-w-lg">
          <p className="text-[14px] font-bold uppercase tracking-wider text-white">
            NO MATCHING TITLES FOUND
          </p>
          <p className="text-[13px] text-[#B8C0D4] mt-1">
            Try clearing the genre filter or searching for another title.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {results.map((movie) => (
              <button
                key={`${movie.mediaType}-${movie.tmdbId}-${movie.id}`}
                type="button"
                onClick={() => handlePickMovie(movie)}
                className="group relative aspect-video rounded-[6px] overflow-hidden bg-[#131A35] text-left hover:ring-2 hover:ring-white transition-all cursor-pointer"
              >
                <img
                  src={movie.backdropUrl}
                  alt={movie.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(10,14,28,0.4) 0%, rgba(10,14,28,0) 40%, rgba(8,12,24,0.92) 100%)',
                  }}
                />
                <div className="absolute top-2.5 left-3">
                  <ProviderLogo provider={movie.provider} size="sm" />
                </div>
                <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
                  {movie.source === 'tmdb' && (
                    <Badge variant="default" className="px-1.5 text-[9px]">
                      TMDB
                    </Badge>
                  )}
                  <Badge variant="gold" className="px-1.5 text-[9px]">
                    {movie.resolution}
                  </Badge>
                </div>
                <div className="absolute bottom-2.5 left-3 right-3">
                  <div className="text-[13px] font-bold uppercase text-white line-clamp-1">
                    {movie.title}
                  </div>
                  <div className="text-[10px] text-[#B8C0D4]">
                    {movie.year} • {movie.genres.slice(0, 2).join(' / ')}
                    {movie.ratingCount > 0 ? ` • ${movie.communityRating}★` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {hasNextPage && (
            <div className="mt-7 flex justify-center">
              <Button
                type="button"
                variant="backlit"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="px-8"
              >
                {isFetchingNextPage
                  ? 'LOADING...'
                  : `LOAD MORE RESULTS (PAGE ${currentPage + 1} / ${totalPages})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
