import React from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import { ProviderLogo } from '@/components/ProviderLogo';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useVodShell } from '@/context/VodShellContext';
import { useFullCatalogQuery } from '@/hooks/useVodQueries';
import { MoodTag } from '@/types';

const GENRE_TILES = [
  { genre: 'SCI-FI', subtitle: 'Orbital & Deep Space' },
  { genre: 'ACTION', subtitle: 'High-Velocity Thrills' },
  { genre: 'DRAMA', subtitle: 'Acclaimed Stories' },
  { genre: 'ADVENTURE', subtitle: 'Expeditions & Quests' },
  { genre: 'THRILLER', subtitle: 'Suspense & Mystery' },
  { genre: 'ANIMATION', subtitle: 'Stylized Worlds' },
  { genre: 'COMEDY', subtitle: 'Lighthearted Breaks' },
  { genre: 'HORROR', subtitle: 'Dark & Uncharted' },
];

const MOOD_PRESETS: Array<{ mood: MoodTag; label: string }> = [
  { mood: 'mind-bending', label: 'MIND-BENDING' },
  { mood: 'epic', label: 'EPIC SCALE' },
  { mood: 'intense', label: 'INTENSE' },
  { mood: 'dramatic', label: 'DRAMATIC' },
  { mood: 'fun', label: 'FUN & LIGHT' },
  { mood: 'calm', label: 'CALM ORBIT' },
];

export const DiscoverPage: React.FC = () => {
  const { activeUserId } = useAuth();
  const { navigateToMovie } = useVodShell();
  const { data, isPending } = useFullCatalogQuery({
    userId: activeUserId,
    category: 'all',
    genre: 'ALL',
    mood: 'all',
    sort: 'popular',
    page: 1,
    source: 'auto',
  });

  const topItems = (data?.items ?? []).slice(0, 12);

  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 py-8 space-y-10 min-h-[calc(100dvh-66px)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#373B47] pb-4">
        <div>
          <h1 className="text-[22px] font-bold uppercase tracking-[0.06em] text-white flex items-center gap-2.5">
            <Compass size={20} className="text-[#F0EA75]" />
            DISCOVER BY GENRE & MOOD
          </h1>
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#87899D] mt-1">
            NAVIGATE GENRE CLUSTERS, MOOD TELEMETRY, AND TOP COMMUNITY PICKS
          </p>
        </div>

        <Link
          to="/search"
          search={{ q: '', genre: 'ALL', mediaType: 'all' }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[3px] border border-[#373B47] text-[11px] font-bold uppercase tracking-wider text-white hover:border-[#F0EA75] hover:text-[#F0EA75]"
        >
          <span>OPEN FULL SEARCH</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Genre Hub Grid */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-white">
          EXPLORE BY GENRE
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {GENRE_TILES.map((item) => (
            <Link
              key={item.genre}
              to="/films"
              search={{
                page: 1,
                genre: item.genre,
                sort: 'popular',
                mood: 'all',
                source: 'auto',
              }}
              className="group p-4 rounded-[4px] border border-[#373B47] bg-[#0B1023]/90 hover:border-[#F0EA75] hover:bg-[#131A35] transition-all flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold uppercase tracking-wider text-white group-hover:text-[#F0EA75]">
                  {item.genre}
                </span>
                <ArrowRight
                  size={14}
                  className="text-[#87899D] group-hover:text-[#F0EA75] group-hover:translate-x-0.5 transition-transform"
                />
              </div>
              <span className="text-[11px] text-[#87899D]">{item.subtitle}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Mood Shortcuts */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-white flex items-center gap-2">
          <Sparkles size={14} className="text-[#F0EA75]" />
          CABIN MOOD PRESETS
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {MOOD_PRESETS.map((m) => (
            <Link
              key={m.mood}
              to="/"
              search={{ mood: m.mood }}
              className="px-4 py-2 rounded-[2px] border border-[#373B47] bg-[#060914] text-[11px] font-bold uppercase tracking-[0.1em] text-[#C8D0E0] hover:border-white hover:text-white transition-colors"
            >
              {m.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Top Community Rated with API Artwork */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-white">
            TOP COMMUNITY RATED
          </h2>
          <Link
            to="/films"
            search={{
              page: 1,
              genre: 'ALL',
              sort: 'popular',
              mood: 'all',
              source: 'auto',
            }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F0EA75] hover:underline"
          >
            <span>VIEW FULL CATALOG</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {isPending && topItems.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topItems.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => navigateToMovie(movie)}
                className="group relative aspect-video rounded-[6px] overflow-hidden bg-[#131A35] text-left border border-[#373B47]/50 hover:border-white transition-all cursor-pointer"
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
                <Badge
                  variant="gold"
                  className="absolute top-2.5 right-3 px-1.5 text-[9px]"
                >
                  {movie.resolution}
                </Badge>
                <div className="absolute bottom-2.5 left-3 right-3">
                  <div className="text-[13px] font-bold uppercase text-white line-clamp-1">
                    {movie.title}
                  </div>
                  <div className="text-[10px] text-[#B8C0D4] mt-0.5">
                    {movie.year} • {movie.genres.slice(0, 2).join(' / ')}
                    {movie.ratingCount > 0 ? ` • ${movie.communityRating}★` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
