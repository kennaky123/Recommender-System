import React, { useEffect, useState } from 'react';
import { X, FastForward, MonitorPlay, Sparkle } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlaybackDevice, RecommendedMovie } from '../types';

interface VidLinkPlayerModalProps {
  movie: RecommendedMovie;
  mode: 'watch' | 'trailer';
  season?: number;
  episode?: number;
  device: PlaybackDevice;
  onClose: () => void;
  onProgressSync: (
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season: number,
    episode: number
  ) => void;
}

export const VidLinkPlayerModal: React.FC<VidLinkPlayerModalProps> = ({
  movie,
  mode,
  season = 1,
  episode = 1,
  device,
  onClose,
  onProgressSync,
}) => {
  const [simulatedPct, setSimulatedPct] = useState(
    Math.round(movie.progressPercent ?? 15)
  );
  const [telemetryNotice, setTelemetryNotice] = useState<string | null>(null);

  const vidlinkUrl =
    movie.mediaType === 'tv'
      ? `https://vidlink.pro/tv/${movie.tmdbId}/${season}/${episode}?primaryColor=F0EA75&secondaryColor=101831&iconColor=FFFFFF&autoplay=true`
      : `https://vidlink.pro/movie/${movie.tmdbId}?primaryColor=F0EA75&secondaryColor=101831&iconColor=FFFFFF&autoplay=true`;

  const trailerUrl = movie.trailerYoutubeId
    ? `https://www.youtube.com/embed/${movie.trailerYoutubeId}?autoplay=1&rel=0`
    : vidlinkUrl;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://vidlink.pro') return;
      const payload = event.data as {
        type?: string;
        data?: {
          progress?: { watched?: number; duration?: number };
          last_season_watched?: number;
          last_episode_watched?: number;
        };
      };
      if (payload?.type === 'MEDIA_DATA' && payload.data?.progress) {
        const watched = Number(payload.data.progress.watched || 0);
        const duration = Number(
          payload.data.progress.duration || movie.runtimeMinutes * 60
        );
        if (duration > 0) {
          onProgressSync(
            movie.id,
            watched,
            duration,
            payload.data.last_season_watched || season,
            payload.data.last_episode_watched || episode
          );
          setTelemetryNotice(
            'VIDLINK PLAYBACK TELEMETRY SYNCED TO RECOMMENDATION ENGINE'
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [movie.id, movie.runtimeMinutes, season, episode, onProgressSync]);

  const handleSimulateProgress = () => {
    const nextPct = Math.min(95, simulatedPct + 25);
    setSimulatedPct(nextPct);
    const totalSec = Math.max(1200, movie.runtimeMinutes * 60);
    const watchedSec = Math.round((nextPct / 100) * totalSec);
    onProgressSync(movie.id, watchedSec, totalSec, season, episode);
    setTelemetryNotice(
      `LOGGED ${nextPct}% WATCH PROGRESS — HYBRID AI PREFERENCES UPDATED`
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {/* Cabin Telemetry Strip */}
        <div className="h-14 px-6 border-b border-[#373B47] bg-[#060911] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Badge variant="gold" className="shrink-0">
              {mode === 'trailer' ? 'TRAILER' : movie.resolution}
            </Badge>
            <DialogTitle className="truncate">
              {movie.title}
              {movie.mediaType === 'tv' && mode === 'watch' && (
                <span className="ml-2 text-[12px] font-normal text-[#B8C0D4]">
                  S{season} EP{episode}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              VidLink Pro streaming player for {movie.title}
            </DialogDescription>
            <Badge variant="secondary" className="hidden md:inline-flex">
              <MonitorPlay size={12} />
              {device}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {mode === 'watch' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSimulateProgress}
                className="hidden sm:inline-flex border-[#87899D] hover:border-[#F0EA75] hover:text-[#F0EA75]"
                title="Simulate VidLink postMessage implicit feedback for recommendation engine"
              >
                <FastForward size={13} weight="bold" />
                <span>SYNC +25% PROGRESS</span>
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="bg-white/10 hover:bg-white hover:text-[#0F1429]"
            >
              <X size={14} weight="bold" />
              <span>CLOSE (ESC)</span>
            </Button>
          </div>
        </div>

        {telemetryNotice && (
          <div className="px-6 py-1.5 bg-[#101831] border-b border-[#373B47] flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#F0EA75]">
            <Sparkle size={13} weight="fill" />
            <span>{telemetryNotice}</span>
          </div>
        )}

        {/* Embedded VidLink / Trailer Iframe */}
        <div className="flex-1 relative bg-black">
          <iframe
            src={mode === 'trailer' ? trailerUrl : vidlinkUrl}
            title={movie.title}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            className="w-full h-full border-0"
          />
        </div>

        {/* Bottom Source Metadata */}
        <div className="px-6 py-2 bg-[#060911] border-t border-[#373B47] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#87899D]">
          <span>
            STREAM ENDPOINT:{' '}
            <code className="text-[#C8D0E0]">
              {mode === 'trailer' && movie.trailerYoutubeId
                ? `youtube.com/embed/${movie.trailerYoutubeId}`
                : vidlinkUrl.split('?')[0]}
            </code>
          </span>
          <span>
            TMDB ID: <strong className="text-white">{movie.tmdbId}</strong> •
            IMPLICIT FEEDBACK LISTENER ACTIVE
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
