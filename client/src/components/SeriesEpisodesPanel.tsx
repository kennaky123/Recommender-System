import React from 'react';
import { ArrowLeft, Play } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Episode, RecommendedMovie } from '../types';

interface SeriesEpisodesPanelProps {
  movie: RecommendedMovie;
  activeSeason: number;
  focusedEpisode: Episode | null;
  onSelectSeason: (season: number) => void;
  onFocusEpisode: (ep: Episode) => void;
  onPlayEpisode: (ep: Episode) => void;
  onBack: () => void;
}

export const SeriesEpisodesPanel: React.FC<SeriesEpisodesPanelProps> = ({
  movie,
  activeSeason,
  focusedEpisode,
  onSelectSeason,
  onFocusEpisode,
  onPlayEpisode,
  onBack,
}) => {
  const seasons = Array.from(
    { length: Math.max(1, movie.seasonsCount ?? 1) },
    (_, i) => i + 1
  );
  const episodes = (movie.episodes ?? []).filter(
    (ep) => ep.season === activeSeason
  );

  return (
    <section className="relative z-10 pl-20 lg:pl-24 pr-8 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#373B47] pb-3 mb-5">
        <Tabs
          value={String(activeSeason)}
          onValueChange={(val) => onSelectSeason(Number(val))}
        >
          <TabsList>
            {seasons.map((s) => (
              <TabsTrigger key={s} value={String(s)}>
                SEASON {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-[#C8D0E0] hover:text-white"
        >
          <ArrowLeft size={14} weight="bold" />
          <span>BACK TO ROWS</span>
        </Button>
      </div>

      {/* Horizontal 16:9 Landscape Episode Cards */}
      <div className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar pb-2">
        {episodes.map((ep) => {
          const isFocused =
            focusedEpisode?.season === ep.season &&
            focusedEpisode?.episode === ep.episode;
          return (
            <button
              key={`${ep.season}-${ep.episode}`}
              type="button"
              onMouseEnter={() => onFocusEpisode(ep)}
              onClick={() => onPlayEpisode(ep)}
              className={`group relative flex-none w-[240px] sm:w-[270px] lg:w-[calc((100%-56px)/4.72)] aspect-video rounded-[6px] overflow-hidden bg-[#131A35] text-left transition-all cursor-pointer ${
                isFocused
                  ? 'spacex-card-focused scale-[1.015]'
                  : 'opacity-90 hover:opacity-100'
              }`}
            >
              <img
                src={ep.backdropUrl || movie.backdropUrl}
                alt={ep.title}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(10,14,28,0.35) 0%, rgba(10,14,28,0) 40%, rgba(8,12,24,0.92) 100%)',
                }}
              />
              <Badge
                variant="secondary"
                className="absolute top-2.5 left-3 border-[#87899D] text-white"
              >
                S{ep.season} EP{ep.episode}
              </Badge>
              <div className="absolute top-2.5 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play size={18} weight="fill" className="text-[#F0EA75]" />
              </div>
              <div className="absolute bottom-2.5 left-3 right-3">
                <div className="text-[13px] font-bold uppercase text-white leading-tight line-clamp-1">
                  {ep.title}
                </div>
                <div className="text-[10px] text-[#B8C0D4] mt-0.5">
                  {ep.runtimeMinutes}M
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
