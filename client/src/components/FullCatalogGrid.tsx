import React, { useEffect, useState } from 'react';
import { CaretLeft, CaretRight, Database, Globe } from '@phosphor-icons/react';
import { fetchFullCatalog } from '../api';
import { CatalogSort, MoodTag, RecommendedMovie } from '../types';
import { ProviderLogo } from './ProviderLogo';

interface FullCatalogGridProps {
  category: 'all' | 'films' | 'shows';
  activeMood: MoodTag;
  focusedId: number | null;
  tmdbEnabled: boolean;
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
  onFocusItem,
  onSelectItem,
}) => {
  const [genre, setGenre] = useState('ALL');
  const [sort, setSort] = useState<CatalogSort>('popular');
  const [source, setSource] = useState<'auto' | 'tmdb'>('auto');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RecommendedMovie[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activeSource, setActiveSource] = useState('postgres');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [category, genre, sort, activeMood, source]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFullCatalog({
      category,
      genre,
      mood: activeMood,
      sort,
      page,
      limit: 24,
      source,
    })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setActiveSource(res.source);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category, genre, activeMood, sort, page, source]);

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
            SOURCE: <span className="text-[#F0EA75]">{activeSource.toUpperCase()}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tmdbEnabled && (
            <div className="flex items-center border border-[#373B47] rounded-[2px] overflow-hidden">
              <button
                type="button"
                onClick={() => setSource('auto')}
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
                onClick={() => setSource('tmdb')}
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
            onChange={(e) => setSort(e.target.value as CatalogSort)}
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
          <button
            key={g}
            type="button"
            onClick={() => setGenre(g)}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] rounded-[2px] border cursor-pointer transition-colors ${
              genre === g
                ? 'bg-white text-[#0F1429] border-white'
                : 'border-[#373B47] text-[#B8C0D4] hover:border-white hover:text-white'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-video rounded-[6px] bg-[#131A35] animate-pulse border border-[#373B47]/40"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-[#373B47] bg-[#0B1023] p-8 rounded-[4px] max-w-lg">
          <p className="text-[14px] font-bold uppercase text-white">
            NO TITLES IN THIS FILTER
          </p>
          <p className="text-[12px] text-[#B8C0D4] mt-1">
            Try switching genre back to ALL or changing mood filter.
          </p>
        </div>
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
                <div className="absolute top-2.5 right-3 px-1.5 py-0.5 text-[9px] font-extrabold bg-[#F0EA75] text-[#0F1429] rounded-[2px]">
                  {movie.resolution}
                </div>
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
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#373B47] rounded-[3px] text-[12px] font-bold uppercase tracking-wider text-white disabled:opacity-35 hover:border-white cursor-pointer disabled:cursor-not-allowed"
          >
            <CaretLeft size={14} weight="bold" />
            <span>PREVIOUS</span>
          </button>

          <div className="text-[12px] font-bold uppercase tracking-widest text-[#C8D0E0] tabular-nums">
            PAGE {page} OF {totalPages}
          </div>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#373B47] rounded-[3px] text-[12px] font-bold uppercase tracking-wider text-white disabled:opacity-35 hover:border-white cursor-pointer disabled:cursor-not-allowed"
          >
            <span>NEXT</span>
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
      )}
    </section>
  );
};
