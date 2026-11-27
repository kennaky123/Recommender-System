import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { fetchMovieById } from '../api';
import { HeroPreview } from '../components/HeroPreview';
import { SeriesEpisodesPanel } from '../components/SeriesEpisodesPanel';
import { useVodShell } from '../context/VodShellContext';
import { Episode, RecommendedMovie } from '../types';

export const SeriesDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { movieId } = useParams({ strict: false }) as { movieId: string };
  const search = useSearch({ strict: false }) as { season?: number };

  const {
    feed,
    focusedMovie,
    selectedDevice,
    setSelectedDevice,
    handleToggleMyList,
    handleRate,
    launchPlayer,
    navigateToCategory,
  } = useVodShell();

  const numericId = Number(movieId);
  const [seriesMovie, setSeriesMovie] = useState<RecommendedMovie | null>(() => {
    if (focusedMovie && focusedMovie.id === numericId) return focusedMovie;
    const fromFeed =
      feed?.newForYou.find((m) => m.id === numericId) ??
      feed?.popularSuggestions.find((m) => m.id === numericId) ??
      feed?.continueWatching.find((m) => m.id === numericId) ??
      feed?.myList.find((m) => m.id === numericId);
    return fromFeed ?? null;
  });

  const activeSeason = search.season ?? seriesMovie?.lastSeason ?? 1;
  const [focusedEpisode, setFocusedEpisode] = useState<Episode | null>(null);

  useEffect(() => {
    if (seriesMovie && seriesMovie.id === numericId) return;
    let alive = true;
    fetchMovieById(numericId)
      .then((m) => {
        if (alive) setSeriesMovie(m);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [numericId, seriesMovie]);

  useEffect(() => {
    if (!seriesMovie) return;
    const first =
      (seriesMovie.episodes ?? []).find((ep) => ep.season === activeSeason) ??
      seriesMovie.episodes?.[0] ??
      null;
    setFocusedEpisode(first);
  }, [seriesMovie, activeSeason]);

  if (!seriesMovie) {
    return (
      <div className="pl-24 pr-10 pt-16">
        <div className="h-64 w-full max-w-2xl bg-[#131A35] rounded-[6px] animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <HeroPreview
        movie={seriesMovie}
        showActions
        selectedDevice={selectedDevice}
        onSelectDevice={setSelectedDevice}
        episodePrefix={
          focusedEpisode
            ? `S${focusedEpisode.season} EP${focusedEpisode.episode}:`
            : undefined
        }
        onTrailer={(m) => launchPlayer(m, 'trailer', 1, 1)}
        onWatch={(m) =>
          launchPlayer(
            m,
            'watch',
            focusedEpisode?.season ?? activeSeason,
            focusedEpisode?.episode ?? 1
          )
        }
        onToggleMyList={handleToggleMyList}
        onRate={handleRate}
      />

      <SeriesEpisodesPanel
        movie={seriesMovie}
        activeSeason={activeSeason}
        focusedEpisode={focusedEpisode}
        onSelectSeason={(s) =>
          navigate({
            to: '/series/$movieId',
            params: { movieId: String(seriesMovie.id) },
            search: { season: s },
          })
        }
        onFocusEpisode={setFocusedEpisode}
        onPlayEpisode={(ep) =>
          launchPlayer(seriesMovie, 'watch', ep.season, ep.episode)
        }
        onBack={() => navigateToCategory('home')}
      />
    </>
  );
};
