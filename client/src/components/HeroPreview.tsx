import React, { useState } from 'react';
import {
  TelevisionSimple,
  UserPlus,
  Check,
  Star,
  ListBullets,
  CaretDown,
} from '@phosphor-icons/react';
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
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
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
        {/* Horizontal Left-to-Right Navy Mask */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, #0F1429 0%, #0F1429 28%, rgba(15, 20, 41, 0.88) 46%, rgba(15, 20, 41, 0.25) 75%, rgba(15, 20, 41, 0.08) 100%)',
          }}
        />
        {/* Vertical Bottom-to-Top Navy Mask */}
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
        {/* Provider Wordmark + AI Match Indicator */}
        <div className="flex items-center gap-3">
          <ProviderLogo provider={movie.provider} size="md" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#F0EA75]">
            {movie.matchScore}% MATCH
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.08em] text-[#B8C0D4]">
            • {movie.matchReason}
          </span>
        </div>

        {/* Bold ALL CAPS Hero Title */}
        <h1 className="text-[34px] sm:text-[42px] lg:text-[50px] font-bold uppercase leading-[1.02] tracking-[0.01em] text-white">
          {movie.title}
        </h1>

        {/* 2-Line Synopsis */}
        <p className="text-[14px] lg:text-[15px] leading-[1.45] text-[#C8D0E0] line-clamp-2 max-w-[54ch]">
          {episodePrefix ? `${episodePrefix} ` : ''}
          {movie.synopsis}
        </p>

        {/* Metadata Line + Outlined Badges + Gold 8K Tag */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-[13px] font-bold tracking-wider text-white tabular-nums mr-1.5">
            {movie.year} <span className="mx-1 text-[#87899D]">|</span>{' '}
            {movie.runtimeMinutes}M
          </span>

          {movie.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white border border-[#87899D] rounded-[2px]"
            >
              {genre}
            </span>
          ))}

          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white border border-[#87899D] rounded-[2px]">
            {movie.ageRating}
          </span>

          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] bg-[#F0EA75] text-[#0F1429] rounded-[2px]">
            {movie.resolution}
          </span>
        </div>

        {/* Action Row + Inline 5-Star Rating */}
        {showActions && (
          <div className="flex flex-wrap items-center gap-3 pt-2.5">
            <button
              type="button"
              onClick={() => onTrailer(movie)}
              className="spacex-backlit-btn h-[42px] px-9 text-[13px] font-bold uppercase tracking-[0.08em] cursor-pointer active:scale-[0.98] transition-transform"
            >
              TRAILER
            </button>

            {/* WATCH + Device Selector (Module 5: Choose where to play / VR) */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => onWatch(movie)}
                className="h-[42px] pl-4 pr-3 inline-flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-white border border-[#87899D]/70 hover:border-white hover:bg-white/10 rounded-l-[3px] transition-colors cursor-pointer active:scale-[0.98]"
              >
                <TelevisionSimple size={17} weight="bold" />
                <span>WATCH</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceMenuOpen((v) => !v)}
                title={`Playback Device: ${selectedDevice}`}
                className="h-[42px] px-2 inline-flex items-center border border-l-0 border-[#87899D]/70 hover:border-white hover:bg-white/10 text-[#C8D0E0] rounded-r-[3px] cursor-pointer"
              >
                <CaretDown size={13} weight="bold" />
              </button>

              {deviceMenuOpen && (
                <div className="absolute left-0 top-[48px] z-30 w-52 bg-[#060914] border border-[#373B47] rounded-[3px] shadow-2xl py-1">
                  <div className="px-3 py-1 text-[9px] uppercase tracking-[0.14em] text-[#87899D]">
                    PLAYBACK TARGET
                  </div>
                  {DEVICES.map((dev) => (
                    <button
                      key={dev}
                      type="button"
                      onClick={() => {
                        onSelectDevice(dev);
                        setDeviceMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                        selectedDevice === dev
                          ? 'bg-white/15 text-[#F0EA75]'
                          : 'text-[#C8D0E0] hover:bg-white/10'
                      }`}
                    >
                      {dev}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onToggleMyList(movie.id)}
              className={`h-[42px] px-4 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] border rounded-[3px] transition-colors cursor-pointer active:scale-[0.98] ${
                movie.inMyList
                  ? 'border-[#F0EA75] text-[#F0EA75] bg-[#F0EA75]/10'
                  : 'border-transparent text-white/90 hover:border-[#87899D]/70 hover:bg-white/5'
              }`}
            >
              {movie.inMyList ? (
                <Check size={16} weight="bold" />
              ) : (
                <UserPlus size={16} weight="bold" />
              )}
              <span>{movie.inMyList ? 'IN LIST' : 'MY LIST'}</span>
            </button>

            {movie.mediaType === 'tv' && onOpenEpisodes && (
              <button
                type="button"
                onClick={() => onOpenEpisodes(movie)}
                className="h-[42px] px-4 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[#C8D0E0] hover:text-white border border-[#373B47] hover:border-white rounded-[3px] transition-colors cursor-pointer"
              >
                <ListBullets size={16} weight="bold" />
                <span>EPISODES</span>
              </button>
            )}

            {/* Quick 5-Star Feedback for Hybrid Recommendation Re-Ranking */}
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
