// server/src/controllers/__tests__/UserControllerAuth.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { UserController } from '../UserController';
import { JwtAuthMiddleware } from '../../middleware/JwtAuthMiddleware';
import { JwtTokenProvider } from '../../services/auth/JwtTokenProvider';
import { IUserActivityService } from '../../services/interfaces/ServiceInterfaces';
import { RecommendationFeedDTO } from '../../domain/types';

function createStubUserService(): IUserActivityService {
  const dummyFeed = { storageMode: 'memory-fallback' } as unknown as RecommendationFeedDTO;
  return {
    async getProfileSummary(userId) {
      return { profile: { id: userId }, ratings: [], watchlistCount: 0, watchHistoryCount: 0 };
    },
    async getWatchlist() {
      return [1, 2];
    },
    async toggleWatchlist() {
      return { inMyList: true, feed: dummyFeed };
    },
    async rateMedia(_u, movieId, rating) {
      return { ok: true, movieId, rating, feed: dummyFeed };
    },
    async recordWatchProgress(userId, movieId, progressSeconds, durationSeconds) {
      return {
        record: {
          userId,
          movieId,
          progressSeconds,
          durationSeconds,
          progressPercent: 50,
          lastSeason: 1,
          lastEpisode: 1,
          updatedAt: new Date().toISOString(),
        },
        feed: dummyFeed,
      };
    },
  };
}

test('UserController protects all 5 /api/user/:userId/* routes with 401/400/403/200 ownership checks', async () => {
  const tokens = new JwtTokenProvider({ jwtSecret: 'ctrl-secret', jwtExpiresIn: '1h' });
  const mw = new JwtAuthMiddleware(tokens, 'internal-tok');
  const controller = new UserController(createStubUserService(), mw);

  const app = express();
  app.use(express.json());
  app.use('/api', controller.getRouter());

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const user1Token = tokens.sign({ userId: 1, email: 'u1@s.v', name: 'U1', role: 'user' });
  const resToken = tokens.sign({ userId: 9, email: 'res@s.v', name: 'RES', role: 'researcher' });
  const adminToken = tokens.sign({ userId: 10, email: 'adm@s.v', name: 'ADM', role: 'admin' });
  const expiredToken = jwt.sign(
    { userId: 1, email: 'u1@s.v', name: 'U1', role: 'user' },
    'ctrl-secret',
    { expiresIn: -10 }
  );

  const endpoints: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [
    { method: 'GET', path: '/api/user/2/profile' },
    { method: 'GET', path: '/api/user/2/watchlist' },
    { method: 'POST', path: '/api/user/2/watchlist/10' },
    { method: 'POST', path: '/api/user/2/ratings', body: { movieId: 10, rating: 4.5 } },
    {
      method: 'POST',
      path: '/api/user/2/watch-progress',
      body: { movieId: 10, progressSeconds: 60, durationSeconds: 120 },
    },
  ];

  try {
    for (const ep of endpoints) {
      const initBase: RequestInit = {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : {},
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      };

      const r401 = await fetch(`${base}${ep.path}`, initBase);
      assert.equal(r401.status, 401, `expected 401 for unauthenticated ${ep.method} ${ep.path}`);

      const r401Expired = await fetch(`${base}${ep.path}`, {
        ...initBase,
        headers: { ...initBase.headers, Authorization: `Bearer ${expiredToken}` },
      });
      assert.equal(r401Expired.status, 401, `expected 401 for expired JWT ${ep.method} ${ep.path}`);

      const badUserPath = ep.path.replace('/user/2/', '/user/abc/');
      const r400 = await fetch(`${base}${badUserPath}`, {
        ...initBase,
        headers: { ...initBase.headers, Authorization: `Bearer ${user1Token}` },
      });
      assert.equal(r400.status, 400, `expected 400 for malformed userId ${ep.method} ${badUserPath}`);

      const r403 = await fetch(`${base}${ep.path}`, {
        ...initBase,
        headers: { ...initBase.headers, Authorization: `Bearer ${user1Token}` },
      });
      assert.equal(r403.status, 403, `expected 403 for cross-user ${ep.method} ${ep.path}`);

      const r200Res = await fetch(`${base}${ep.path}`, {
        ...initBase,
        headers: { ...initBase.headers, Authorization: `Bearer ${resToken}` },
      });
      assert.equal(r200Res.status, 200, `expected 200 for researcher ${ep.method} ${ep.path}`);

      const r200Adm = await fetch(`${base}${ep.path}`, {
        ...initBase,
        headers: { ...initBase.headers, Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r200Adm.status, 200, `expected 200 for admin ${ep.method} ${ep.path}`);

      const selfPath = ep.path.replace('/user/2/', '/user/1/');
      const r200Self = await fetch(`${base}${selfPath}`, {
        ...initBase,
        headers: { ...initBase.headers, Authorization: `Bearer ${user1Token}` },
      });
      assert.equal(r200Self.status, 200, `expected 200 for owner ${ep.method} ${selfPath}`);
    }
  } finally {
    server.close();
  }
});
