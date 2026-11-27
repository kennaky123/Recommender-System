import React, { useState } from 'react';
import {
  TelevisionSimple,
  UserPlus,
  Check,
  Star,
  ListBullets,
  CaretDown,
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlaybackDevice, RecommendedMovie } from '../types';
import { ProviderLogo } from './ProviderLogo';

interface HeroPreviewProps {
  movie: RecommendedMovie;
  showActions: boolean;
  selectedDevice: PlaybackDevice;
  onSelectDevice: (device: PlaybackDevice) => void;
  onWatch: (movie: RecommendedMovie) => void;
  onTrailer: (movie: RecommendedMovie) => void;
  onToggleMyList: (movieId: number) => void;
  onRate: (movieId: number, rating: number) => void;
  onOpenEpisodes?: (movie: RecommendedMovie) => void;
  episodePrefix?: string;
}

const DEVICES: PlaybackDevice[] = [
  'CABIN DISPLAY 8K',
  'CREW TABLET',
  'SPACE-X VR HEADSET',
];

export const HeroPreview: React.FC<HeroPreviewProps> = ({
  movie,
  showActions,
  selectedDevice,
  onSelectDevice,
  onWatch,
  onTrailer,
  onToggleMyList,
  onRate,
  onOpenEpisodes,
  episodePrefix,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayedStars = hoverRating ?? movie.userRating ?? 0;

  return (
    <section className="relative w-full min-h-[340px] lg:min-h-[395px] flex items-end pb-7 pt-7 pl-20 pr-8 lg:pl-24 lg:pr-12 overflow-hidden">
      {/* Right-Weighted Full-Bleed Cinematic Backdrop */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0F1429]">
        <img
          src={movie.backdropUrl}
          alt={movie.title}
          className="absolute right-0 top-0 h-full w-full md:w-[74%] object-cover object-center opacity-90 transition-all duration-500"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, #0F1429 0%, #0F1429 28%, rgba(15, 20, 41, 0.88) 46%, rgba(15, 20, 41, 0.25) 75%, rgba(15, 20, 41, 0.08) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(0deg, #101831 0%, rgba(16, 24, 49, 0.72) 22%, rgba(15, 20, 41, 0.0) 58%)',
          }}
        />
      </div>

      {/* Left-Aligned Metadata & Controls */}
      <div className="relative z-10 max-w-[580px] flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <ProviderLogo provider={movie.provider} size="md" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#F0EA75]">
            {movie.matchScore}% MATCH
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.08em] text-[#B8C0D4]">
            • {movie.matchReason}
          </span>
        </div>

        <h1 className="text-[34px] sm:text-[42px] lg:text-[50px] font-bold uppercase leading-[1.02] tracking-[0.01em] text-white">
          {movie.title}
        </h1>

        <p className="text-[14px] lg:text-[15px] leading-[1.45] text-[#C8D0E0] line-clamp-2 max-w-[54ch]">
          {episodePrefix ? `${episodePrefix} ` : ''}
          {movie.synopsis}
        </p>

        {/* Metadata Line + shadcn/ui Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-[13px] font-bold tracking-wider text-white tabular-nums mr-1.5">
            {movie.year} <span className="mx-1 text-[#87899D]">|</span>{' '}
            {movie.runtimeMinutes}M
          </span>

          {movie.genres.slice(0, 3).map((genre) => (
            <Badge key={genre} variant="outline">
              {genre}
            </Badge>
          ))}

          <Badge variant="outline" className="px-1.5">
            {movie.ageRating}
          </Badge>

          <Badge variant="gold">{movie.resolution}</Badge>
        </div>

        {/* Action Row + Radix DropdownMenu + 5-Star Rating */}
        {showActions && (
          <div className="flex flex-wrap items-center gap-3 pt-2.5">
            <Button
              type="button"
              variant="backlit"
              size="lg"
              onClick={() => onTrailer(movie)}
            >
              TRAILER
            </Button>

            <div className="flex items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => onWatch(movie)}
                className="pl-4 pr-3 rounded-r-none"
              >
                <TelevisionSimple size={17} weight="bold" />
                <span>WATCH</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Playback Device: ${selectedDevice}`}
                    title={`Playback Device: ${selectedDevice}`}
                    className="px-2 border-l-0 rounded-l-none text-[#C8D0E0]"
                  >
                    <CaretDown size={13} weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>PLAYBACK TARGET</DropdownMenuLabel>
                  {DEVICES.map((dev) => (
                    <DropdownMenuItem
                      key={dev}
                      onClick={() => onSelectDevice(dev)}
                      className={
                        selectedDevice === dev
                          ? 'bg-white/15 text-[#F0EA75]'
                          : 'text-[#C8D0E0]'
                      }
                    >
                      {dev}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              type="button"
              variant={movie.inMyList ? 'gold' : 'ghost'}
              onClick={() => onToggleMyList(movie.id)}
              className="px-4"
            >
              {movie.inMyList ? (
                <Check size={16} weight="bold" />
              ) : (
                <UserPlus size={16} weight="bold" />
              )}
              <span>{movie.inMyList ? 'IN LIST' : 'MY LIST'}</span>
            </Button>

            {movie.mediaType === 'tv' && onOpenEpisodes && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenEpisodes(movie)}
                className="h-[42px] px-4"
              >
                <ListBullets size={16} weight="bold" />
                <span>EPISODES</span>
              </Button>
            )}

            <div
              className="flex items-center gap-1 pl-2 border-l border-[#373B47]"
              title="Rate to re-rank AI recommendations"
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => onRate(movie.id, star)}
                  aria-label={`Rate ${star} stars`}
                  className="p-0.5 cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    size={15}
                    weight={star <= displayedStars ? 'fill' : 'regular'}
                    className={
                      star <= displayedStars ? 'text-[#F0EA75]' : 'text-[#87899D]'
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
