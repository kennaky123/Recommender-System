import React, { useMemo } from 'react';
import { useParams, useRouter } from '@tanstack/react-router';
import { ArrowLeft, Film, Star, Tv } from 'lucide-react';
import { ContentRow } from '@/components/ContentRow';
import { HeroPreview } from '@/components/HeroPreview';
import { ProviderLogo } from '@/components/ProviderLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useVodShell } from '@/context/VodShellContext';
import { useMovieDetailQuery, useSimilarMoviesQuery } from '@/hooks/useVodQueries';
import { RecommendedMovie } from '@/types';

export const MovieDetailPage: React.FC = () => {
  const router = useRouter();
  const { movieId } = useParams({ strict: false }) as { movieId: string };
  const { activeUserId } = useAuth();
  const {
    feed,
    focusedMovie,
    selectedDevice,
    setSelectedDevice,
    handleToggleMyList,
    handleRate,
    launchPlayer,
    navigateToMovie,
    navigateToSeries,
    navigateToCategory,
  } = useVodShell();

  const numericId = Number(movieId);

  const cachedFromFeed = useMemo(() => {
    if (!Number.isFinite(numericId)) return undefined;
    if (focusedMovie?.id === numericId) return focusedMovie;
    const pool = [
      feed?.heroFeatured,
      ...(feed?.continueWatching ?? []),
      ...(feed?.newForYou ?? []),
      ...(feed?.becauseYouWatched?.items ?? []),
      ...(feed?.popularSuggestions ?? []),
      ...(feed?.myList ?? []),
    ];
    return pool.find((m) => m?.id === numericId);
  }, [feed, focusedMovie, numericId]);

  const { data: fetchedMovie, isPending } = useMovieDetailQuery(numericId, true);
  const { data: similarMovies = [] } = useSimilarMoviesQuery(
    numericId,
    activeUserId
  );

  const movie: RecommendedMovie | null = useMemo(() => {
    if (fetchedMovie && cachedFromFeed) {
      return {
        ...cachedFromFeed,
        ...fetchedMovie,
        backdropUrl:
          fetchedMovie.backdropUrl && !fetchedMovie.backdropUrl.startsWith('/backdrops/')
            ? fetchedMovie.backdropUrl
            : cachedFromFeed.backdropUrl,
      };
    }
    return cachedFromFeed ?? fetchedMovie ?? null;
  }, [cachedFromFeed, fetchedMovie]);

  if (isPending && !movie) {
    return (
      <div className="pl-20 lg:pl-24 pr-8 pt-10 space-y-6">
        <Skeleton className="h-72 w-full max-w-4xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="pl-20 lg:pl-24 pr-8 pt-12">
        <Card className="p-8 max-w-lg">
          <p className="text-[15px] font-bold uppercase text-white">
            TITLE NOT FOUND
          </p>
          <p className="text-[13px] text-[#B8C0D4] mt-1">
            We could not locate movie telemetry for ID #{movieId}.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigateToCategory('home')}
            className="mt-4"
          >
            <ArrowLeft size={14} strokeWidth={2.2} />
            <span>BACK TO HOME</span>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="pl-20 lg:pl-24 pr-8 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) {
              router.history.back();
            } else {
              navigateToCategory('home');
            }
          }}
          className="text-[#C8D0E0] hover:text-white px-0"
        >
          <ArrowLeft size={14} strokeWidth={2.2} />
          <span>BACK</span>
        </Button>
      </div>

      <HeroPreview
        movie={movie}
        showActions
        selectedDevice={selectedDevice}
        onSelectDevice={setSelectedDevice}
        onTrailer={(m) => launchPlayer(m, 'trailer', 1, 1)}
        onWatch={(m) => launchPlayer(m, 'watch')}
        onToggleMyList={handleToggleMyList}
        onRate={handleRate}
        onOpenEpisodes={
          movie.mediaType === 'tv' ? (m) => navigateToSeries(m) : undefined
        }
      />

      <section className="relative z-10 pl-20 lg:pl-24 pr-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  {movie.mediaType === 'tv' ? (
                    <Tv size={15} className="text-[#F0EA75]" />
                  ) : (
                    <Film size={15} className="text-[#F0EA75]" />
                  )}
                  MISSION BRIEFING & SYNOPSIS
                </span>
                <ProviderLogo provider={movie.provider} size="sm" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[14px] leading-relaxed text-[#C8D0E0]">
                {movie.synopsis || 'No synopsis provided for this title.'}
              </p>

              {movie.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#373B47]/60">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87899D] mr-1">
                    TAGS:
                  </span>
                  {movie.tags.slice(0, 8).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">TITLE TELEMETRY</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#87899D] uppercase">RELEASE</span>
                <span className="font-bold text-white tabular-nums">
                  {movie.year}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#87899D] uppercase">RUNTIME</span>
                <span className="font-bold text-white tabular-nums">
                  {movie.runtimeMinutes} MIN
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#87899D] uppercase">RATING</span>
                <span className="inline-flex items-center gap-1 font-bold text-[#F0EA75] tabular-nums">
                  <Star size={12} fill="currentColor" />
                  {movie.communityRating.toFixed(1)} ({movie.ratingCount})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#87899D] uppercase">FORMAT</span>
                <span className="font-bold text-white">{movie.resolution}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#87899D] uppercase">TMDB ID</span>
                <span className="font-bold text-white tabular-nums">
                  #{movie.tmdbId}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {similarMovies.length > 0 && (
        <ContentRow
          title="SIMILAR TITLES — HYBRID AI"
          items={similarMovies}
          focusedId={movie.id}
          onFocusItem={() => {}}
          onSelectItem={navigateToMovie}
        />
      )}
    </div>
  );
};
