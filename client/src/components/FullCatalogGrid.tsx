import React, { useState } from 'react';
import { CaretLeft, CaretRight, Database, Globe } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFullCatalogQuery } from '@/hooks/useVodQueries';
import { CatalogSort, MoodTag, RecommendedMovie } from '@/types';
import { ProviderLogo } from './ProviderLogo';

export interface CatalogFilterState {
  genre: string;
  sort: CatalogSort;
  page: number;
  source: 'auto' | 'tmdb';
}

interface FullCatalogGridProps {
  category: 'all' | 'films' | 'shows';
  activeMood: MoodTag;
  focusedId: number | null;
  tmdbEnabled: boolean;
  genre?: string;
  sort?: CatalogSort;
  page?: number;
  source?: 'auto' | 'tmdb';
  onChangeFilters?: (next: CatalogFilterState) => void;
  onFocusItem: (movie: RecommendedMovie) => void;
  onSelectItem: (movie: RecommendedMovie) => void;
}

const GENRES = [
  'ALL',
  'SCI-FI',
  'ACTION',
  'DRAMA',
  'ADVENTURE',
  'COMEDY',
  'THRILLER',
  'ANIMATION',
  'HORROR',
  'ROMANCE',
  'CRIME',
];

export const FullCatalogGrid: React.FC<FullCatalogGridProps> = ({
  category,
  activeMood,
  focusedId,
  tmdbEnabled,
  genre: controlledGenre,
  sort: controlledSort,
  page: controlledPage,
  source: controlledSource,
  onChangeFilters,
  onFocusItem,
  onSelectItem,
}) => {
  const [localGenre, setLocalGenre] = useState('ALL');
  const [localSort, setLocalSort] = useState<CatalogSort>('popular');
  const [localSource, setLocalSource] = useState<'auto' | 'tmdb'>('auto');
  const [localPage, setLocalPage] = useState(1);

  const genre = controlledGenre ?? localGenre;
  const sort = controlledSort ?? localSort;
  const source = controlledSource ?? localSource;
  const page = controlledPage ?? localPage;

  const { data, isPending, isFetching } = useFullCatalogQuery({
    category,
    genre,
    mood: activeMood,
    sort,
    page,
    source,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const activeSource = data?.source ?? 'postgres';

  const updateFilters = (patch: Partial<CatalogFilterState>) => {
    const next: CatalogFilterState = {
      genre: patch.genre ?? genre,
      sort: patch.sort ?? sort,
      source: patch.source ?? source,
      page: patch.page ?? page,
    };
    if (onChangeFilters) {
      onChangeFilters(next);
    } else {
      setLocalGenre(next.genre);
      setLocalSort(next.sort);
      setLocalSource(next.source);
      setLocalPage(next.page);
    }
  };

  return (
    <section className="relative z-10 pl-20 lg:pl-24 pr-8 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#373B47] pb-4 mb-5">
        <div>
          <h2 className="text-[14px] font-bold uppercase tracking-[0.08em] text-white">
            FULL API CATALOG —{' '}
            {category === 'films'
              ? 'FILMS'
              : category === 'shows'
              ? 'TV SHOWS'
              : 'ALL TITLES'}
          </h2>
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#87899D] mt-0.5 tabular-nums">
            {total.toLocaleString()} TITLES AVAILABLE • PAGE {page} / {totalPages} •
            SOURCE:{' '}
            <span className="text-[#F0EA75]">{activeSource.toUpperCase()}</span>
            {isFetching && !isPending ? ' • SYNCING...' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tmdbEnabled && (
            <div className="flex items-center border border-[#373B47] rounded-[2px] overflow-hidden">
              <button
                type="button"
                onClick={() => updateFilters({ source: 'auto', page: 1 })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                  source === 'auto'
                    ? 'bg-white text-[#0F1429]'
                    : 'text-[#B8C0D4] hover:text-white'
                }`}
              >
                <Database size={12} />
                <span>PGSQL MOVIELENS</span>
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ source: 'tmdb', page: 1 })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                  source === 'tmdb'
                    ? 'bg-white text-[#0F1429]'
                    : 'text-[#B8C0D4] hover:text-white'
                }`}
              >
                <Globe size={12} />
                <span>TMDB LIVE</span>
              </button>
            </div>
          )}

          <select
            value={sort}
            onChange={(e) =>
              updateFilters({ sort: e.target.value as CatalogSort, page: 1 })
            }
            aria-label="Sort catalog"
            className="h-8 px-3 bg-[#060914] border border-[#373B47] rounded-[2px] text-[11px] font-bold uppercase tracking-wider text-white focus:outline-none focus:border-white cursor-pointer"
          >
            <option value="popular">SORT: MOST RATED</option>
            <option value="newest">SORT: NEWEST</option>
            <option value="title">SORT: A - Z</option>
          </select>
        </div>
      </div>

      {/* Genre Pills */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {GENRES.map((g) => (
          <Button
            key={g}
            type="button"
            variant={genre === g ? 'default' : 'secondary'}
            size="sm"
            onClick={() => updateFilters({ genre: g, page: 1 })}
            className="h-7 rounded-[2px]"
          >
            {g}
          </Button>
        ))}
      </div>

      {/* Grid */}
      {isPending && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-video" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 max-w-lg">
          <p className="text-[14px] font-bold uppercase text-white">
            NO TITLES IN THIS FILTER
          </p>
          <p className="text-[12px] text-[#B8C0D4] mt-1">
            Try switching genre back to ALL or changing mood filter.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((movie) => {
            const isFocused = focusedId === movie.id;
            return (
              <button
                key={`${movie.mediaType}-${movie.tmdbId}-${movie.id}`}
                type="button"
                onMouseEnter={() => onFocusItem(movie)}
                onFocus={() => onFocusItem(movie)}
                onClick={() => onSelectItem(movie)}
                className={`group relative aspect-video rounded-[6px] overflow-hidden bg-[#131A35] text-left transition-all cursor-pointer focus:outline-none ${
                  isFocused
                    ? 'spacex-card-focused scale-[1.015]'
                    : 'opacity-92 hover:opacity-100'
                }`}
              >
                <img
                  src={movie.backdropUrl}
                  alt={movie.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(10,14,28,0.45) 0%, rgba(10,14,28,0) 40%, rgba(8,12,24,0.92) 100%)',
                  }}
                />
                <div className="absolute top-2.5 left-3 pointer-events-none">
                  <ProviderLogo provider={movie.provider} size="sm" />
                </div>
                <Badge
                  variant="gold"
                  className="absolute top-2.5 right-3 px-1.5 text-[9px]"
                >
                  {movie.resolution}
                </Badge>
                <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none">
                  <div className="text-[13px] font-bold uppercase text-white line-clamp-1">
                    {movie.title}
                  </div>
                  <div className="text-[10px] text-[#B8C0D4] mt-0.5">
                    {movie.year} • {movie.genres.slice(0, 2).join(' / ')}
                    {movie.ratingCount > 0 ? ` • ${movie.communityRating}★` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between gap-4 border-t border-[#373B47] pt-5">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => updateFilters({ page: Math.max(1, page - 1) })}
          >
            <CaretLeft size={14} weight="bold" />
            <span>PREVIOUS</span>
          </Button>

          <div className="text-[12px] font-bold uppercase tracking-widest text-[#C8D0E0] tabular-nums">
            PAGE {page} OF {totalPages}
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() =>
              updateFilters({ page: Math.min(totalPages, page + 1) })
            }
          >
            <span>NEXT</span>
            <CaretRight size={14} weight="bold" />
          </Button>
        </div>
      )}
    </section>
  );
};
