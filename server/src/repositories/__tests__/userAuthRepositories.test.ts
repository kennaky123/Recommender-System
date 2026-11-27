// server/src/repositories/__tests__/userAuthRepositories.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { DrizzleMediaRepository } from '../DrizzleMediaRepository';
import { InMemoryMediaRepository } from '../InMemoryMediaRepository';
import { PostgresMediaRepository } from '../PostgresMediaRepository';
import { DatabaseConnection } from '../DatabaseConnection';

test('InMemoryMediaRepository stores, reads, and defensively clones role and onboarding fields', async () => {
  const repo = new InMemoryMediaRepository();

  const demo = await repo.findUserByEmail('claude@spacex.vod');
  assert.ok(demo);
  assert.equal(demo.role, 'user');
  assert.equal(demo.onboardingCompleted, false);
  assert.deepEqual(demo.preferredGenres, []);
  assert.deepEqual(demo.preferredMoods, []);

  const created = await repo.createAuthUser({
    name: 'ALICE',
    email: 'alice@spacex.vod',
    passwordHash: 'hash',
    avatarUrl: '/backdrops/claude-patterson.jpg',
  });
  assert.equal(created.role, 'user');
  assert.equal(created.onboardingCompleted, false);
  assert.deepEqual(created.preferredGenres, []);
  assert.deepEqual(created.preferredMoods, []);

  const profile = await repo.getUserProfile(created.id);
  profile.preferredGenres.push('MUTATED');
  const profileAgain = await repo.getUserProfile(created.id);
  assert.deepEqual(profileAgain.preferredGenres, []);
});

test('DrizzleMediaRepository maps role and onboarding fields in getUserProfile, findUserByEmail, and createAuthUser', async () => {
  const dbRow = {
    id: 42,
    name: 'DR. CHEN',
    email: 'chen@spacex.vod',
    passwordHash: 'hashed-pw',
    avatarUrl: '/backdrops/claude-patterson.jpg',
    createdAt: new Date(),
    role: 'researcher',
    onboardingCompleted: true,
    preferredGenres: ['SCI-FI', 'THRILLER'],
    preferredMoods: ['intense', 'not-a-mood'],
    isSynthetic: false,
  };

  let insertedValues: Record<string, unknown> | null = null;
  const fakeDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [dbRow],
        }),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        insertedValues = vals;
        return {
          returning: async () => [
            {
              ...dbRow,
              id: 43,
              name: String(vals.name),
              email: String(vals.email),
              role: String(vals.role ?? 'user'),
              onboardingCompleted: Boolean(vals.onboardingCompleted ?? false),
              preferredGenres: (vals.preferredGenres as string[]) ?? [],
              preferredMoods: (vals.preferredMoods as string[]) ?? [],
            },
          ],
        };
      },
    }),
  };

  const repo = new DrizzleMediaRepository({ db: fakeDb } as unknown as DatabaseConnection);

  const profile = await repo.getUserProfile(42);
  assert.equal(profile.role, 'researcher');
  assert.equal(profile.onboardingCompleted, true);
  assert.deepEqual(profile.preferredGenres, ['SCI-FI', 'THRILLER']);
  assert.deepEqual(profile.preferredMoods, ['intense']);

  const found = await repo.findUserByEmail('chen@spacex.vod');
  assert.ok(found);
  assert.equal(found.role, 'researcher');
  assert.equal(found.onboardingCompleted, true);
  assert.deepEqual(found.preferredMoods, ['intense']);

  const created = await repo.createAuthUser({
    name: 'NEW USER',
    email: 'new@spacex.vod',
    passwordHash: 'h',
    avatarUrl: '/a.jpg',
  });
  assert.equal(insertedValues?.['role'], 'user');
  assert.equal(insertedValues?.['onboardingCompleted'], false);
  assert.equal(created.role, 'user');
  assert.equal(created.onboardingCompleted, false);
});

test('PostgresMediaRepository maps role and onboarding fields consistently for LSP parity', async () => {
  const row = {
    id: 77,
    name: 'DR. ORBIT',
    email: 'orbit@spacex.vod',
    password_hash: 'hashed',
    avatar_url: '/backdrops/claude-patterson.jpg',
    role: 'admin',
    onboarding_completed: true,
    preferred_genres: ['SCI-FI'],
    preferred_moods: ['epic', 'bogus'],
  };

  const fakePool = {
    async query(sqlText: string, params: unknown[]) {
      if (sqlText.startsWith('INSERT INTO users')) {
        return {
          rows: [
            {
              id: 78,
              name: params[0],
              email: params[1],
              password_hash: params[2],
              avatar_url: params[3],
              role: 'user',
              onboarding_completed: false,
              preferred_genres: [],
              preferred_moods: [],
            },
          ],
        };
      }
      return { rows: [row] };
    },
  } as unknown as Pool;

  const repo = new PostgresMediaRepository({ pool: fakePool } as unknown as DatabaseConnection);
  const profile = await repo.getUserProfile(77);
  assert.equal(profile.role, 'admin');
  assert.equal(profile.onboardingCompleted, true);
  assert.deepEqual(profile.preferredGenres, ['SCI-FI']);
  assert.deepEqual(profile.preferredMoods, ['epic']);

  const found = await repo.findUserByEmail('orbit@spacex.vod');
  assert.ok(found);
  assert.equal(found.role, 'admin');
  assert.deepEqual(found.preferredMoods, ['epic']);

  const created = await repo.createAuthUser({
    name: 'NEW',
    email: 'n@s.v',
    passwordHash: 'p',
    avatarUrl: '/a.jpg',
  });
  assert.equal(created.role, 'user');
  assert.equal(created.onboardingCompleted, false);
  assert.deepEqual(created.preferredGenres, []);
  assert.deepEqual(created.preferredMoods, []);
});
