import { Router } from 'express';
import { getDataStore } from '../db/store';
import {
  getSimilarMovies,
  invalidateRecommendationCache,
} from '../services/recommendationEngine';
import {
  enrichMovieBackdrop,
  fetchTmdbPopular,
  isTmdbConfigured,
  searchTmdbMulti,
} from '../services/tmdbService';
import { CatalogSort, MoodTag, Movie, RecommendedMovie } from '../types';

export const moviesRouter = Router();

function toRecommendedShell(m: Movie): RecommendedMovie {
  return {
    ...m,
    matchScore: 90,
    matchReason: m.source === 'tmdb' ? `TMDB LIVE • #${m.tmdbId}` : `TMDB #${m.tmdbId}`,
    inMyList: false,
    communityRating: 4.2,
    ratingCount: 0,
  };
}

moviesRouter.get('/movies', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 24;
    const store = getDataStore();
    const result = await store.searchMoviesPaginated({ page, limit });
    res.json({ movies: result.items, ...result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

moviesRouter.get('/catalog', async (req, res) => {
  try {
    const userId = Number(req.query.userId) || 1;
    const category = String(req.query.category ?? 'all');
    const mediaType =
      category === 'films'
        ? 'movie'
        : category === 'shows'
        ? 'tv'
        : (String(req.query.mediaType ?? 'all') as 'all' | 'movie' | 'tv');
    const genre = req.query.genre ? String(req.query.genre) : 'ALL';
    const mood = (String(req.query.mood ?? 'all') as MoodTag) || 'all';
    const sort = (String(req.query.sort ?? 'popular') as CatalogSort) || 'popular';
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 24;
    const source = String(req.query.source ?? 'auto');

    const tmdbEnabled = isTmdbConfigured();

    if (source === 'tmdb' && tmdbEnabled) {
      const tmdbPage = await fetchTmdbPopular(mediaType, page);
      return res.json({
        items: tmdbPage.items.map(toRecommendedShell),
        total: tmdbPage.total,
        page,
        totalPages: tmdbPage.totalPages,
        tmdbEnabled,
        source: 'tmdb',
      });
    }

    const store = getDataStore();
    const result = await store.searchMoviesPaginated({
      userId,
      mood,
      genre,
      mediaType,
      sort,
      page,
      limit,
    });

    res.json({
      ...result,
      tmdbEnabled,
      source: store.getStorageMode() === 'postgres' ? 'postgres' : 'memory',
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

moviesRouter.get('/search', async (req, res) => {
  try {
    const userId = Number(req.query.userId) || 1;
    const q = String(req.query.q ?? '');
    const mood = (String(req.query.mood ?? 'all') as MoodTag) || 'all';
    const genre = req.query.genre ? String(req.query.genre) : 'ALL';
    const mediaType =
      (String(req.query.mediaType ?? 'all') as 'all' | 'movie' | 'tv') || 'all';
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 24;

    const store = getDataStore();
    const tmdbEnabled = isTmdbConfigured();

    const dbResult = await store.searchMoviesPaginated({
      userId,
      query: q,
      mood,
      genre,
      mediaType,
      sort: 'popular',
      page,
      limit,
    });

    let mergedMovies = dbResult.items;
    let total = dbResult.total;
    let totalPages = dbResult.totalPages;
    const sourcesUsed = [store.getStorageMode() === 'postgres' ? 'PGSQL' : 'LOCAL'];

    if (q.trim() && tmdbEnabled) {
      const tmdbRes = await searchTmdbMulti(q, page, mediaType);
      if (tmdbRes.items.length > 0) {
        sourcesUsed.push('TMDB LIVE');
        const seenTmdb = new Set(
          mergedMovies.map((m) => `${m.mediaType}:${m.tmdbId}`)
        );
        const extraTmdb = tmdbRes.items
          .filter((item) => !seenTmdb.has(`${item.mediaType}:${item.tmdbId}`))
          .map(toRecommendedShell);
        mergedMovies = [...mergedMovies, ...extraTmdb];
        total = Math.max(total, tmdbRes.total);
        totalPages = Math.max(totalPages, tmdbRes.totalPages);
      }
    }

    res.json({
      movies: mergedMovies,
      total,
      page,
      totalPages,
      tmdbEnabled,
      sourcesUsed,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

moviesRouter.post('/movies/ensure', async (req, res) => {
  try {
    const payload = req.body as Partial<Movie>;
    if (!payload.tmdbId || !payload.title) {
      return res.status(400).json({ error: 'tmdbId and title are required' });
    }
    const store = getDataStore();
    const inserted = await store.upsertExternalMovie({
      movielensId: payload.movielensId ?? null,
      tmdbId: Number(payload.tmdbId),
      imdbId: payload.imdbId ?? null,
      mediaType: payload.mediaType === 'tv' ? 'tv' : 'movie',
      title: String(payload.title).toUpperCase(),
      provider: payload.provider || 'NETFLIX',
      year: Number(payload.year) || 2021,
      runtimeMinutes: Number(payload.runtimeMinutes) || 115,
      ageRating: payload.ageRating || '15',
      resolution: payload.resolution || '8K',
      genres: Array.isArray(payload.genres) ? payload.genres : ['CINEMA'],
      tags: Array.isArray(payload.tags) ? payload.tags : ['tmdb-live'],
      moods: Array.isArray(payload.moods) ? payload.moods : ['dramatic'],
      synopsis: payload.synopsis || '',
      backdropUrl: payload.backdropUrl || '/backdrops/interstellar.jpg',
      trailerYoutubeId: payload.trailerYoutubeId ?? null,
      seasonsCount: payload.seasonsCount ?? 1,
      episodes: payload.episodes ?? [],
      source: 'tmdb',
    });

    const enriched = await enrichMovieBackdrop(inserted);
    if (
      enriched.backdropUrl !== inserted.backdropUrl ||
      enriched.trailerYoutubeId !== inserted.trailerYoutubeId
    ) {
      await store.updateMovieEnrichment(inserted.id, {
        backdropUrl: enriched.backdropUrl,
        synopsis: enriched.synopsis,
        runtimeMinutes: enriched.runtimeMinutes,
        trailerYoutubeId: enriched.trailerYoutubeId,
        seasonsCount: enriched.seasonsCount,
      });
    }
    invalidateRecommendationCache();

    res.json({ movie: toRecommendedShell(enriched) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

moviesRouter.get('/movies/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid movie id' });
    }
    const store = getDataStore();
    const movie = await store.getMovieById(id);
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    const enriched = await enrichMovieBackdrop(movie);
    if (
      enriched.backdropUrl !== movie.backdropUrl ||
      enriched.trailerYoutubeId !== movie.trailerYoutubeId
    ) {
      await store.updateMovieEnrichment(movie.id, {
        backdropUrl: enriched.backdropUrl,
        synopsis: enriched.synopsis,
        runtimeMinutes: enriched.runtimeMinutes,
        trailerYoutubeId: enriched.trailerYoutubeId,
        seasonsCount: enriched.seasonsCount,
      });
    }
    res.json({ movie: enriched });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

moviesRouter.get('/movies/:id/similar', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.query.userId) || 1;
    const limit = Number(req.query.limit) || 6;
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid movie id' });
    }
    const store = getDataStore();
    const items = await getSimilarMovies(store, id, userId, limit);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
