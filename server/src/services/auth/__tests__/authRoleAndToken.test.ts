// server/src/services/auth/__tests__/authRoleAndToken.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { normalizeMoodTags, normalizeUserRole, AuthUserRecord } from '../../../domain/types';
import { JwtTokenProvider } from '../JwtTokenProvider';
import { AuthService } from '../AuthService';
import { BcryptPasswordHasher } from '../BcryptPasswordHasher';
import { IAuthUserRepository } from '../../../repositories/interfaces/RepositoryInterfaces';

test('normalizeUserRole and normalizeMoodTags coerce valid values and fall back safely', () => {
  assert.equal(normalizeUserRole('user'), 'user');
  assert.equal(normalizeUserRole('researcher'), 'researcher');
  assert.equal(normalizeUserRole('admin'), 'admin');
  assert.equal(normalizeUserRole('superadmin'), 'user');
  assert.equal(normalizeUserRole(null), 'user');
  assert.equal(normalizeUserRole(undefined), 'user');

  assert.deepEqual(normalizeMoodTags(['epic', 'invalid-mood', 'mind-bending', 42]), [
    'epic',
    'mind-bending',
  ]);
  assert.deepEqual(normalizeMoodTags(null), []);
});

test('JwtTokenProvider preserves role, defaults legacy tokens to user, and rejects invalid userId', () => {
  const provider = new JwtTokenProvider({ jwtSecret: 'unit-secret', jwtExpiresIn: '1h' });

  const signed = provider.sign({
    userId: 7,
    email: 'res@spacex.vod',
    name: 'RESEARCHER',
    role: 'researcher',
  });
  assert.deepEqual(provider.verify(signed), {
    userId: 7,
    email: 'res@spacex.vod',
    name: 'RESEARCHER',
    role: 'researcher',
  });

  const legacyToken = jwt.sign(
    { userId: 3, email: 'legacy@spacex.vod', name: 'LEGACY' },
    'unit-secret',
    { expiresIn: '1h' }
  );
  assert.equal(provider.verify(legacyToken).role, 'user');

  const forgedRoleToken = jwt.sign(
    { userId: 4, email: 'x@spacex.vod', name: 'X', role: 'root' },
    'unit-secret',
    { expiresIn: '1h' }
  );
  assert.equal(provider.verify(forgedRoleToken).role, 'user');

  const badIdToken = jwt.sign(
    { userId: 0, email: 'bad@spacex.vod', name: 'BAD', role: 'admin' },
    'unit-secret',
    { expiresIn: '1h' }
  );
  assert.throws(() => provider.verify(badIdToken), /Invalid token payload/);
});

test('AuthService includes role in JWT and onboarding fields in PublicUserDTO on register, login, and getCurrentUser', async () => {
  const hasher = new BcryptPasswordHasher(4);
  const tokens = new JwtTokenProvider({ jwtSecret: 'svc-secret', jwtExpiresIn: '1h' });
  const store: AuthUserRecord[] = [
    {
      id: 10,
      name: 'DR. VEGA',
      email: 'vega@spacex.vod',
      passwordHash: hasher.hash('Orbit2026'),
      avatarUrl: '/backdrops/claude-patterson.jpg',
      role: 'researcher',
      onboardingCompleted: true,
      preferredGenres: ['SCI-FI', 'DRAMA'],
      preferredMoods: ['mind-bending'],
    },
  ];

  const repo: IAuthUserRepository = {
    async findUserByEmail(email) {
      return store.find((u) => u.email === email) ?? null;
    },
    async findUserById(id) {
      return store.find((u) => u.id === id) ?? null;
    },
    async createAuthUser(input) {
      const created: AuthUserRecord = {
        id: store.length + 11,
        ...input,
        role: 'user',
        onboardingCompleted: false,
        preferredGenres: [],
        preferredMoods: [],
      };
      store.push(created);
      return created;
    },
  };

  const svc = new AuthService({ userRepo: repo, passwordHasher: hasher, tokenProvider: tokens });

  const loginRes = await svc.login({ email: 'vega@spacex.vod', password: 'Orbit2026' });
  assert.equal(loginRes.user.role, 'researcher');
  assert.equal(loginRes.user.onboardingCompleted, true);
  assert.deepEqual(loginRes.user.preferredGenres, ['SCI-FI', 'DRAMA']);
  assert.deepEqual(loginRes.user.preferredMoods, ['mind-bending']);
  assert.equal(tokens.verify(loginRes.token).role, 'researcher');

  const regRes = await svc.register({
    name: 'Nova Crew',
    email: 'nova@spacex.vod',
    password: 'Password1',
  });
  assert.equal(regRes.user.role, 'user');
  assert.equal(regRes.user.onboardingCompleted, false);
  assert.deepEqual(regRes.user.preferredGenres, []);
  assert.deepEqual(regRes.user.preferredMoods, []);
  assert.equal(tokens.verify(regRes.token).role, 'user');

  const me = await svc.getCurrentUser(loginRes.token);
  assert.equal(me.role, 'researcher');
  assert.equal(me.onboardingCompleted, true);
});
