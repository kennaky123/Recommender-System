import React from 'react';
import { Link } from '@tanstack/react-router';
import { Bookmark, Play, Trash2 } from 'lucide-react';
import { ProviderLogo } from '@/components/ProviderLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useVodShell } from '@/context/VodShellContext';

export const MyListPage: React.FC = () => {
  const { feed, navigateToMovie, launchPlayer, handleToggleMyList } =
    useVodShell();

  const myList = feed?.myList ?? [];
  const continueWatching = feed?.continueWatching ?? [];

  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 py-8 space-y-10 min-h-[calc(100dvh-66px)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#373B47] pb-4">
        <div>
          <h1 className="text-[22px] font-bold uppercase tracking-[0.06em] text-white flex items-center gap-2.5">
            <Bookmark size={20} className="text-[#F0EA75]" />
            MY WATCHLIST & PROGRESS
          </h1>
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#87899D] mt-1 tabular-nums">
            {myList.length} SAVED IN MY LIST • {continueWatching.length} IN
            PROGRESS
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link to="/discover">DISCOVER HUB</Link>
          </Button>
          <Button type="button" variant="backlit" size="sm" asChild>
            <Link
              to="/films"
              search={{
                page: 1,
                genre: 'ALL',
                sort: 'popular',
                mood: 'all',
                source: 'auto',
              }}
            >
              BROWSE FILMS
            </Link>
          </Button>
        </div>
      </div>

      {/* My Saved Watchlist */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-white">
          SAVED TITLES ({myList.length})
        </h2>

        {myList.length === 0 ? (
          <Card className="p-8 max-w-xl">
            <p className="text-[14px] font-bold uppercase text-white">
              YOUR WATCHLIST IS EMPTY
            </p>
            <p className="text-[13px] text-[#B8C0D4] mt-1">
              Open any film or series and click MY LIST to save it for your
              mission.
            </p>
            <div className="mt-4 flex gap-3">
              <Button type="button" variant="backlit" size="sm" asChild>
                <Link to="/discover">EXPLORE DISCOVER</Link>
              </Button>
              <Button type="button" variant="secondary" size="sm" asChild>
                <Link
                  to="/films"
                  search={{
                    page: 1,
                    genre: 'ALL',
                    sort: 'popular',
                    mood: 'all',
                    source: 'auto',
                  }}
                >
                  FULL CATALOG
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {myList.map((movie) => (
              <div
                key={movie.id}
                className="group relative aspect-video rounded-[6px] overflow-hidden bg-[#131A35] border border-[#373B47]/60 hover:border-white transition-all"
              >
                <button
                  type="button"
                  onClick={() => navigateToMovie(movie)}
                  className="w-full h-full text-left cursor-pointer focus:outline-none"
                >
                  <img
                    src={movie.backdropUrl}
                    alt={movie.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = '/backdrops/interstellar.jpg';
                    }}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(10,14,28,0.45) 0%, rgba(10,14,28,0) 40%, rgba(8,12,24,0.92) 100%)',
                    }}
                  />
                  <div className="absolute top-2.5 left-3">
                    <ProviderLogo provider={movie.provider} size="sm" />
                  </div>
                  <div className="absolute bottom-2.5 left-3 right-16">
                    <div className="text-[13px] font-bold uppercase text-white line-clamp-1">
                      {movie.title}
                    </div>
                    <div className="text-[10px] text-[#B8C0D4] mt-0.5">
                      {movie.year} • {movie.genres.slice(0, 2).join(' / ')}
                    </div>
                  </div>
                </button>

                <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                  <button
                    type="button"
                    onClick={() => launchPlayer(movie, 'watch')}
                    title="Watch now"
                    className="p-1.5 rounded-[3px] bg-[#060914]/85 text-[#F0EA75] hover:bg-white hover:text-[#0F1429] cursor-pointer"
                  >
                    <Play size={13} fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMyList(movie.id)}
                    title="Remove from My List"
                    className="p-1.5 rounded-[3px] bg-[#060914]/85 text-[#C8D0E0] hover:bg-red-500 hover:text-white cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-white">
            CONTINUE WATCHING ({continueWatching.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {continueWatching.map((movie) => (
              <button
                key={`cw-${movie.id}`}
                type="button"
                onClick={() => navigateToMovie(movie)}
                className="group relative aspect-video rounded-[6px] overflow-hidden bg-[#131A35] text-left border border-[#373B47]/60 hover:border-white transition-all cursor-pointer"
              >
                <img
                  src={movie.backdropUrl}
                  alt={movie.title}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = '/backdrops/interstellar.jpg';
                  }}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(10,14,28,0.4) 0%, rgba(10,14,28,0) 40%, rgba(8,12,24,0.92) 100%)',
                  }}
                />
                <Badge
                  variant="gold"
                  className="absolute top-2.5 right-3 px-1.5 text-[9px]"
                >
                  {Math.round(movie.progressPercent ?? 0)}%
                </Badge>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="text-[13px] font-bold uppercase text-white line-clamp-1">
                    {movie.title}
                  </div>
                </div>
                {movie.progressPercent !== undefined && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
                    <div
                      className="h-full bg-[#F0EA75]"
                      style={{
                        width: `${Math.min(100, Math.max(4, movie.progressPercent))}%`,
                      }}
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
