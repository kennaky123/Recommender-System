import React from 'react';
import { RecommendedMovie } from '../types';
import { ProviderLogo } from './ProviderLogo';

interface ContentRowProps {
  title: string;
  items: RecommendedMovie[];
  focusedId: number | null;
  showProgress?: boolean;
  onFocusItem: (movie: RecommendedMovie) => void;
  onSelectItem: (movie: RecommendedMovie) => void;
}

export const ContentRow: React.FC<ContentRowProps> = ({
  title,
  items,
  focusedId,
  showProgress = false,
  onFocusItem,
  onSelectItem,
}) => {
  if (items.length === 0) return null;

  return (
    <section className="relative z-10 pl-20 lg:pl-24 pr-4 pb-6">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-white mb-3">
        {title}
      </h2>

      <div className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar pb-2 pr-8">
        {items.map((movie) => {
          const isFocused = focusedId === movie.id;
          return (
            <button
              key={movie.id}
              type="button"
              onMouseEnter={() => onFocusItem(movie)}
              onFocus={() => onFocusItem(movie)}
              onClick={() => onSelectItem(movie)}
              className={`group relative flex-none w-[240px] sm:w-[270px] lg:w-[calc((100%-56px)/4.72)] aspect-video rounded-[6px] overflow-hidden bg-[#131A35] text-left transition-all duration-200 cursor-pointer focus:outline-none ${
                isFocused
                  ? 'spacex-card-focused scale-[1.015]'
                  : 'opacity-90 hover:opacity-100'
              }`}
            >
              <img
                src={movie.backdropUrl}
                alt={movie.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />

              {/* Subtle bottom & top scrims for readability */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(10,14,28,0.45) 0%, rgba(10,14,28,0.0) 38%, rgba(8,12,24,0.88) 100%)',
                }}
              />

              {/* Top-left Provider Watermark */}
              <div className="absolute top-2.5 left-3 pointer-events-none">
                <ProviderLogo provider={movie.provider} size="sm" />
              </div>

              {/* Bottom-left Bold ALL CAPS Title */}
              <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none">
                <div className="text-[13px] lg:text-[14px] font-bold uppercase tracking-[0.02em] text-white leading-tight line-clamp-2">
                  {movie.title}
                </div>
              </div>

              {/* Progress Line ONLY in Continue Watching */}
              {showProgress && movie.progressPercent !== undefined && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
                  <div
                    className="h-full bg-[#F0EA75]"
                    style={{ width: `${Math.min(100, Math.max(4, movie.progressPercent))}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
