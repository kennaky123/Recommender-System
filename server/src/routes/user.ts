import { Router } from 'express';
import { getDataStore } from '../db/store';
import {
  generateRecommendations,
  invalidateRecommendationCache,
} from '../services/recommendationEngine';

export const userRouter = Router();

userRouter.get('/user/:userId/profile', async (req, res) => {
  try {
    const userId = Number(req.params.userId) || 1;
    const store = getDataStore();
    const [profile, ratings, watchlist, watchHistory] = await Promise.all([
      store.getUserProfile(userId),
      store.getUserRatings(userId),
      store.getWatchlist(userId),
      store.getWatchHistory(userId),
    ]);

    const ratedTitles = await Promise.all(
      ratings.map(async (r) => {
        const movie = await store.getMovieById(r.movieId);
        return {
          ...r,
          movieTitle: movie?.title ?? `Movie #${r.movieId}`,
        };
      })
    );

    res.json({
      profile,
      storageMode: store.getStorageMode(),
      ratings: ratedTitles,
      watchlistCount: watchlist.length,
      watchHistoryCount: watchHistory.length,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

userRouter.get('/user/:userId/watchlist', async (req, res) => {
  try {
    const userId = Number(req.params.userId) || 1;
    const store = getDataStore();
    const ids = await store.getWatchlist(userId);
    res.json({ movieIds: ids });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

userRouter.post('/user/:userId/watchlist/:movieId', async (req, res) => {
  try {
    const userId = Number(req.params.userId) || 1;
    const movieId = Number(req.params.movieId);
    if (!Number.isFinite(movieId)) {
      return res.status(400).json({ error: 'Invalid movieId' });
    }
    const store = getDataStore();
    const inMyList = await store.toggleWatchlist(userId, movieId);
    const feed = await generateRecommendations(store, userId, 'all', 'home');
    res.json({ inMyList, feed });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

userRouter.post('/user/:userId/ratings', async (req, res) => {
  try {
    const userId = Number(req.params.userId) || 1;
    const { movieId, rating } = req.body as { movieId?: number; rating?: number };
    if (!movieId || !rating || rating < 0.5 || rating > 5) {
      return res
        .status(400)
        .json({ error: 'movieId and rating (0.5..5.0) are required' });
    }
    const store = getDataStore();
    await store.upsertRating(userId, Number(movieId), Number(rating));
    invalidateRecommendationCache();
    const feed = await generateRecommendations(store, userId, 'all', 'home');
    res.json({ ok: true, movieId: Number(movieId), rating: Number(rating), feed });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

userRouter.post('/user/:userId/watch-progress', async (req, res) => {
  try {
    const userId = Number(req.params.userId) || 1;
    const { movieId, progressSeconds, durationSeconds, season, episode } =
      req.body as {
        movieId?: number;
        progressSeconds?: number;
        durationSeconds?: number;
        season?: number;
        episode?: number;
      };
    if (!movieId || progressSeconds === undefined || !durationSeconds) {
      return res.status(400).json({
        error: 'movieId, progressSeconds, and durationSeconds are required',
      });
    }
    const store = getDataStore();
    const record = await store.upsertWatchProgress(
      userId,
      Number(movieId),
      Number(progressSeconds),
      Number(durationSeconds),
      season ? Number(season) : 1,
      episode ? Number(episode) : 1
    );
    const feed = await generateRecommendations(store, userId, 'all', 'home');
    res.json({ record, feed });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
