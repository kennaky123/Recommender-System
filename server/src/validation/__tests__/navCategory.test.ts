// server/src/validation/__tests__/navCategory.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { navCategorySchema, recommendationsQuerySchema } from '../schemas';
import { RecommendationController } from '../../controllers/RecommendationController';
import { IRecommendationService } from '../../services/interfaces/ServiceInterfaces';
import { NavCategory, RecommendationFeedDTO } from '../../domain/types';

test('navCategorySchema only permits home, films, shows', () => {
  assert.equal(navCategorySchema.parse('home'), 'home');
  assert.equal(navCategorySchema.parse('films'), 'films');
  assert.equal(navCategorySchema.parse('shows'), 'shows');
  assert.throws(() => navCategorySchema.parse('live'));
  assert.throws(() => navCategorySchema.parse('audio'));
  assert.throws(() => navCategorySchema.parse('HOME'));
});

test('recommendationsQuerySchema defaults omitted/empty category to home and rejects live/audio', () => {
  assert.equal(recommendationsQuerySchema.parse({}).category, 'home');
  assert.equal(recommendationsQuerySchema.parse({ category: '' }).category, 'home');
  assert.equal(recommendationsQuerySchema.parse({ category: 'films' }).category, 'films');
  assert.equal(recommendationsQuerySchema.parse({ category: 'shows' }).category, 'shows');
  assert.throws(() => recommendationsQuerySchema.parse({ category: 'live' }));
  assert.throws(() => recommendationsQuerySchema.parse({ category: 'audio' }));
});

test('GET /api/recommendations returns 400 for live/audio and 200 for home/films/shows', async () => {
  const seenCategories: NavCategory[] = [];
  const stubRecommender: IRecommendationService = {
    async generateFeed(_userId, _mood, category = 'home') {
      seenCategories.push(category);
      return { storageMode: 'memory-fallback' } as unknown as RecommendationFeedDTO;
    },
    async getSimilarMedia() {
      return [];
    },
  };

  const app = express();
  app.use('/api', new RecommendationController(stubRecommender).getRouter());
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  try {
    for (const valid of ['home', 'films', 'shows']) {
      const res = await fetch(`${base}/api/recommendations?category=${valid}`);
      assert.equal(res.status, 200);
    }
    const resDefault = await fetch(`${base}/api/recommendations`);
    assert.equal(resDefault.status, 200);
    assert.deepEqual(seenCategories, ['home', 'films', 'shows', 'home']);

    for (const invalid of ['live', 'audio']) {
      const res = await fetch(`${base}/api/recommendations?category=${invalid}`);
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error?: string; issues?: unknown[] };
      assert.ok(Array.isArray(body.issues) && body.issues.length > 0);
    }
  } finally {
    server.close();
  }
});
