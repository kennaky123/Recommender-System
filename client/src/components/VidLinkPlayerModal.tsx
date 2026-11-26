import React, { useEffect, useState } from 'react';
import { X, FastForward, MonitorPlay, Sparkle } from '@phosphor-icons/react';
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
          setTelemetryNotice('VIDLINK PLAYBACK TELEMETRY SYNCED TO RECOMMENDATION ENGINE');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [movie.id, movie.runtimeMinutes, season, episode, onProgressSync]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
    <div className="fixed inset-0 z-50 bg-[#04060D]/95 flex flex-col">
      {/* Cabin Telemetry Strip */}
      <div className="h-14 px-6 border-b border-[#373B47] bg-[#060911] flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-[#F0EA75] text-[#0F1429] rounded-[2px] shrink-0">
            {mode === 'trailer' ? 'TRAILER' : movie.resolution}
          </span>
          <div className="truncate">
            <span className="text-[14px] font-bold uppercase tracking-wider text-white">
              {movie.title}
            </span>
            {movie.mediaType === 'tv' && mode === 'watch' && (
              <span className="ml-2 text-[12px] text-[#B8C0D4]">
                S{season} EP{episode}
              </span>
            )}
          </div>
          <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[#87899D] border border-[#373B47] px-2 py-0.5 rounded-[2px]">
            <MonitorPlay size={12} />
            {device}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {mode === 'watch' && (
            <button
              type="button"
              onClick={handleSimulateProgress}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#87899D] text-[#C8D0E0] hover:border-[#F0EA75] hover:text-[#F0EA75] rounded-[2px] cursor-pointer"
              title="Simulate VidLink postMessage implicit feedback for recommendation engine"
            >
              <FastForward size={13} weight="bold" />
              <span>SYNC +25% PROGRESS</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/10 hover:bg-white hover:text-[#0F1429] text-white rounded-[2px] transition-colors cursor-pointer"
          >
            <X size={14} weight="bold" />
            <span>CLOSE (ESC)</span>
          </button>
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
    </div>
  );
};
