// server/src/db/__tests__/repositoryAndSeed.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMovieLensRatingInsertBatch } from '../seedMovielens';
import { DrizzleMediaRepository } from '../../repositories/DrizzleMediaRepository';
import { DatabaseConnection } from '../../repositories/DatabaseConnection';

test('buildMovieLensRatingInsertBatch emits source = movielens for every row without side effects on import', () => {
  const batch = buildMovieLensRatingInsertBatch([
    { userId: 1001, movieId: 55, rating: 4.5, ratedAt: '2020-01-01T00:00:00.000Z' },
    { userId: 1002, movieId: 56, rating: 3.0, ratedAt: '2020-01-02T00:00:00.000Z' },
  ]);
  assert.match(batch.sql, /INSERT INTO ratings \(user_id, movie_id, rating, rated_at, source\)/i);
  assert.match(batch.sql, /ON CONFLICT \(user_id, movie_id\) DO NOTHING/i);
  assert.deepEqual(batch.values, [
    1001, 55, 4.5, '2020-01-01T00:00:00.000Z', 'movielens',
    1002, 56, 3.0, '2020-01-02T00:00:00.000Z', 'movielens',
  ]);
});

function createChainMock(rows: unknown[], callLog: string[]) {
  const chain: Record<string, unknown> = {
    from: () => { callLog.push('from'); return chain; },
    innerJoin: () => { callLog.push('innerJoin'); return chain; },
    where: () => { callLog.push('where'); return chain; },
    orderBy: () => { callLog.push('orderBy'); return chain; },
    limit: () => Promise.resolve(rows),
    then: (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

test('DrizzleMediaRepository coerces pg NUMERIC strings via toNumber and isolates synthetic users/ratings', async () => {
  const callLog: string[] = [];
  const fakeDb = {
    select: () => createChainMock([
      { userId: 1, movieId: 10, rating: '4.5', ratedAt: new Date('2025-01-01T00:00:00Z') },
    ], callLog),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: () => Promise.resolve([
            {
              userId: 1,
              movieId: 10,
              progressSeconds: 120,
              durationSeconds: 240,
              progressPercent: '50.00',
              lastSeason: 1,
              lastEpisode: 1,
              updatedAt: new Date('2025-01-01T00:00:00Z'),
            },
          ]),
        }),
      }),
    }),
    execute: (query: unknown) => {
      const qStr = JSON.stringify(query);
      if (qStr.includes('COUNT(*)::int AS total')) {
        return Promise.resolve({ rows: [{ total: '1' }] });
      }
      return Promise.resolve({
        rows: [
          {
            id: 10,
            movielens_id: 1,
            tmdb_id: 603,
            imdb_id: 'tt0133093',
            media_type: 'movie',
            title: 'THE MATRIX',
            provider: 'NETFLIX',
            release_year: 1999,
            runtime_minutes: 136,
            age_rating: '15',
            resolution: '8K',
            genres: ['SCI-FI'],
            tags: ['matrix'],
            moods: ['mind-bending'],
            synopsis: 'A hacker discovers reality.',
            backdrop_url: '/backdrops/interstellar.jpg',
            trailer_youtube_id: null,
            seasons_count: 1,
            episodes: [],
            avg_rating: '4.25',
            rating_count: '12',
            user_rating: '4.5',
            in_my_list: true,
            progress_percent: '',
            last_season: '1',
            last_episode: null,
          },
        ],
      });
    },
  };

  const repo = new DrizzleMediaRepository({ db: fakeDb } as unknown as DatabaseConnection);

  const allRatings = await repo.getAllRatings();
  assert.ok(callLog.includes('innerJoin'), 'getAllRatings must join users to exclude is_synthetic');
  assert.ok(callLog.includes('where'), 'getAllRatings must filter synthetic users and persona_sim');
  assert.equal(typeof allRatings[0].rating, 'number');
  assert.equal(allRatings[0].rating + 0.5, 5);

  const progress = await repo.upsertWatchProgress(1, 10, 120, 240);
  assert.equal(typeof progress.progressPercent, 'number');
  assert.equal(progress.progressPercent, 50);

  const search = await repo.searchPaginated({ userId: 1, sort: 'popular', page: 1, limit: 24 });
  assert.equal(search.total, 1);
  assert.equal(search.items[0].communityRating, 4.25);
  assert.equal(search.items[0].userRating, 4.5);
  assert.equal(search.items[0].progressPercent, undefined);
  assert.equal(search.items[0].lastSeason, 1);
  assert.equal(search.items[0].lastEpisode, undefined);
});
