import { Router } from 'express';
import { getDataStore } from '../db/store';
import { generateRecommendations } from '../services/recommendationEngine';
import { MoodTag, NavCategory } from '../types';

export const recommendationsRouter = Router();

recommendationsRouter.get('/recommendations', async (req, res) => {
  try {
    const userId = Number(req.query.userId) || 1;
    const mood = (String(req.query.mood ?? 'all') as MoodTag) || 'all';
    const category = (String(req.query.category ?? 'home') as NavCategory) || 'home';
    const store = getDataStore();
    const feed = await generateRecommendations(store, userId, mood, category);
    res.json(feed);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
