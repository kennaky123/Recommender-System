// server/src/validation/__tests__/navCategory.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
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

test('client router does not hardcode CLAUDE PATTERSON or claude-patterson avatar for guest ShellFrame', () => {
  const routerSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../client/src/router.tsx'),
    'utf-8'
  );
  assert.doesNotMatch(routerSource, /userName="CLAUDE PATTERSON"/);
  assert.doesNotMatch(routerSource, /avatarUrl="\/backdrops\/claude-patterson\.jpg"/);
});

test('LeftSidebar renders GUEST PASSENGER / GUEST MODE cleanly without claude-patterson fallback', () => {
  const sidebarSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../client/src/components/LeftSidebar.tsx'),
    'utf-8'
  );
  assert.match(sidebarSource, /'GUEST PASSENGER'/);
  assert.match(sidebarSource, /'GUEST MODE'/);
  assert.doesNotMatch(sidebarSource, /'DEMO PROFILE'/);
  assert.doesNotMatch(sidebarSource, /\/backdrops\/claude-patterson\.jpg/);
});

test('SettingsPanel and useUserProfileQuery gate profile fetch on auth and avoid CLAUDE PATTERSON fallback', () => {
  const queriesSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../client/src/hooks/useVodQueries.ts'),
    'utf-8'
  );
  const settingsSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../client/src/components/SettingsPanel.tsx'),
    'utf-8'
  );
  const loginSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../client/src/pages/LoginPage.tsx'),
    'utf-8'
  );

  assert.match(
    queriesSource,
    /export function useUserProfileQuery\(\s*userId:\s*number,\s*enabled\s*=\s*true\s*\)/
  );
  assert.match(settingsSource, /useUserProfileQuery\(activeUserId,\s*isAuthenticated\)/);
  assert.match(settingsSource, /'GUEST PASSENGER'/);
  assert.doesNotMatch(settingsSource, /CLAUDE PATTERSON/);
  assert.doesNotMatch(settingsSource, /\/backdrops\/claude-patterson\.jpg/);
  // Keep explicit Demo Crew login button intact on LoginPage
  assert.match(loginSource, /USE DEMO CREW ACCOUNT \(CLAUDE PATTERSON\)/);
});

test('server/package.json defines a Windows-safe test script using node --import tsx --test', () => {
  const pkgPath = path.resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    pkg.scripts?.test,
    'node --import tsx --test "src/**/__tests__/*.test.ts"'
  );
});

test('SettingsPanel and AuthContext prevent stale cached profileData from leaking into guest mode after logout', () => {
  const settingsSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../client/src/components/SettingsPanel.tsx'),
    'utf-8'
  );
  const authContextSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../client/src/context/AuthContext.tsx'),
    'utf-8'
  );
  const queryClientSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../client/src/lib/queryClient.ts'),
    'utf-8'
  );

  assert.match(
    settingsSource,
    /const\s+profileData\s*=\s*isAuthenticated\s*\?\s*rawProfileData\s*:\s*undefined/
  );
  assert.match(
    queryClientSource,
    /userProfileRoot:\s*\(\)\s*=>\s*\[\.\.\.vodQueryKeys\.all,\s*'userProfile'\]\s*as\s*const/
  );
  assert.match(
    authContextSource,
    /queryClient\.removeQueries\(\{\s*queryKey:\s*vodQueryKeys\.userProfileRoot\(\)\s*\}\)/
  );
});
