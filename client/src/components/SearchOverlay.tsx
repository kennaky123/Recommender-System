import React, { useEffect, useState } from 'react';
import { MagnifyingGlass, X, Database, Globe } from '@phosphor-icons/react';
import { ensureMovieInDb, searchCatalog } from '../api';
import { RecommendedMovie } from '../types';
import { ProviderLogo } from './ProviderLogo';

interface SearchOverlayProps {
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
  onSelectMovie,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('ALL');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<RecommendedMovie[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);
  const [tmdbEnabled, setTmdbEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [query, genre, mediaType]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchCatalog(query, 'all', genre, mediaType, page, 24)
        .then((res) => {
          if (!active) return;
          setResults((prev) =>
            page === 1 ? res.movies : [...prev, ...res.movies]
          );
          setTotal(res.total);
          setTotalPages(res.totalPages);
          setSourcesUsed(res.sourcesUsed);
          setTmdbEnabled(res.tmdbEnabled);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, genre, mediaType, page]);

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
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2 py-0.5 border border-[#373B47] rounded-[2px] text-[#C8D0E0]"
              >
                {s.includes('TMDB') ? <Globe size={11} /> : <Database size={11} />}
                {s}
              </span>
            ))}
            {!tmdbEnabled && (
              <span className="text-[#87899D]">
                (ADD <code className="text-white">TMDB_API_KEY</code> IN{' '}
                <code className="text-white">server/.env</code> TO ALSO SEARCH ALL LIVE TMDB)
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#373B47] hover:border-white text-[#C8D0E0] hover:text-white rounded-[2px] cursor-pointer"
        >
          <X size={14} weight="bold" />
          <span>BACK TO HOME</span>
        </button>
      </div>

      {/* Search Input + Media Type Switch */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[260px] max-w-2xl">
          <MagnifyingGlass
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#87899D]"
          />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all 9,700+ MovieLens & TMDB titles (e.g. Matrix, Toy Story, Interstellar, Avatar)..."
            className="w-full h-12 pl-11 pr-4 bg-[#060914] border border-[#373B47] focus:border-white rounded-[3px] text-[14px] text-white placeholder:text-[#87899D] focus:outline-none"
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
          <button
            key={g}
            type="button"
            onClick={() => setGenre(g)}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] rounded-[2px] border cursor-pointer ${
              genre === g
                ? 'bg-white text-[#0F1429] border-white'
                : 'border-[#373B47] text-[#B8C0D4] hover:border-white hover:text-white'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Results Grid */}
      {loading && page === 1 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video rounded-[6px] bg-[#131A35] animate-pulse border border-[#373B47]/40"
            />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="border border-[#373B47] bg-[#0B1023] p-8 rounded-[4px] max-w-lg">
          <p className="text-[14px] font-bold uppercase tracking-wider text-white">
            NO MATCHING TITLES FOUND
          </p>
          <p className="text-[13px] text-[#B8C0D4] mt-1">
            Try clearing the genre filter or searching for another title.
          </p>
        </div>
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
                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-white/90 text-[#0F1429] rounded-[2px]">
                      TMDB
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-[#F0EA75] text-[#0F1429] rounded-[2px]">
                    {movie.resolution}
                  </span>
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

          {page < totalPages && (
            <div className="mt-7 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => setPage((p) => p + 1)}
                className="spacex-backlit-btn px-8 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? 'LOADING...'
                  : `LOAD MORE RESULTS (PAGE ${page + 1} / ${totalPages})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
