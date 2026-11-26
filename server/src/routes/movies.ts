import { Router } from 'express';
import { getDataStore } from '../db/store';
import { getSimilarMovies } from '../services/recommendationEngine';
import { enrichMovieBackdrop } from '../services/tmdbService';
import { MoodTag } from '../types';

export const moviesRouter = Router();

moviesRouter.get('/movies', async (_req, res) => {
  try {
    const store = getDataStore();
    const movies = await store.getMovies();
    res.json({ movies });
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

moviesRouter.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '');
    const mood = (String(req.query.mood ?? 'all') as MoodTag) || 'all';
    const genre = req.query.genre ? String(req.query.genre) : undefined;
    const store = getDataStore();
    const movies = await store.searchMovies(q, mood, genre);
    res.json({ movies });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
