import { TMDB_API_KEY } from '../config';
import { Movie } from '../types';

const backdropCache = new Map<string, string>();

export async function enrichMovieBackdrop(movie: Movie): Promise<Movie> {
  if (!TMDB_API_KEY) return movie;
  const cacheKey = `${movie.mediaType}:${movie.tmdbId}`;
  const cached = backdropCache.get(cacheKey);
  if (cached) {
    return { ...movie, backdropUrl: cached };
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${movie.mediaType}/${movie.tmdbId}?api_key=${TMDB_API_KEY}`
    );
    if (!res.ok) return movie;
    const data = (await res.json()) as { backdrop_path?: string; overview?: string };
    if (data.backdrop_path) {
      const url = `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`;
      backdropCache.set(cacheKey, url);
      return {
        ...movie,
        backdropUrl: url,
        synopsis: movie.synopsis || data.overview || '',
      };
    }
  } catch {
    // Keep stored local backdrop gracefully on network/API errors
  }
  return movie;
}
