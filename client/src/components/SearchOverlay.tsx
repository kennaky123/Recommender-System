import React, { useEffect, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { searchCatalog } from '../api';
import { RecommendedMovie } from '../types';
import { ProviderLogo } from './ProviderLogo';

interface SearchOverlayProps {
  onSelectMovie: (movie: RecommendedMovie) => void;
  onClose: () => void;
}

const GENRES = ['ALL', 'SCI-FI', 'ACTION', 'DRAMA', 'ADVENTURE', 'ANIMATION', 'THRILLER'];

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  onSelectMovie,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('ALL');
  const [results, setResults] = useState<RecommendedMovie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchCatalog(query, 'all', genre)
        .then((movies) => {
          if (active) setResults(movies);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, genre]);

  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 py-8 min-h-[calc(100dvh-66px)]">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[22px] font-bold uppercase tracking-[0.06em] text-white">
          SEARCH CATALOG
        </h1>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#373B47] hover:border-white text-[#C8D0E0] hover:text-white rounded-[2px] cursor-pointer"
        >
          <X size={14} weight="bold" />
          <span>BACK TO HOME</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-2xl mb-5">
        <MagnifyingGlass
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#87899D]"
        />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, genres, providers (e.g. Interstellar, Sci-Fi, NETFLIX)..."
          className="w-full h-12 pl-11 pr-4 bg-[#060914] border border-[#373B47] focus:border-white rounded-[3px] text-[14px] text-white placeholder:text-[#87899D] focus:outline-none"
        />
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
      {loading ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {results.map((movie) => (
            <button
              key={movie.id}
              type="button"
              onClick={() => onSelectMovie(movie)}
              className="group relative aspect-video rounded-[6px] overflow-hidden bg-[#131A35] text-left hover:ring-2 hover:ring-white transition-all cursor-pointer"
            >
              <img
                src={movie.backdropUrl}
                alt={movie.title}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(10,14,28,0.4) 0%, rgba(10,14,28,0) 40%, rgba(8,12,24,0.9) 100%)',
                }}
              />
              <div className="absolute top-2.5 left-3">
                <ProviderLogo provider={movie.provider} size="sm" />
              </div>
              <div className="absolute top-2.5 right-3 px-1.5 py-0.5 text-[9px] font-extrabold bg-[#F0EA75] text-[#0F1429] rounded-[2px]">
                {movie.resolution}
              </div>
              <div className="absolute bottom-2.5 left-3 right-3">
                <div className="text-[13px] font-bold uppercase text-white line-clamp-1">
                  {movie.title}
                </div>
                <div className="text-[10px] text-[#B8C0D4]">
                  {movie.year} • {movie.genres.slice(0, 2).join(' / ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
