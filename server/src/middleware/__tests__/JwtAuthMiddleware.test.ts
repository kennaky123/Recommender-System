// server/src/middleware/__tests__/JwtAuthMiddleware.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { JwtTokenProvider } from '../../services/auth/JwtTokenProvider';
import { AuthenticatedRequest, JwtAuthMiddleware } from '../JwtAuthMiddleware';

function startTestApp(internalToken = 'secret-internal') {
  const tokens = new JwtTokenProvider({ jwtSecret: 'test-secret', jwtExpiresIn: '1h' });
  const mw = new JwtAuthMiddleware(tokens, internalToken);
  const app = express();
  app.get('/api/public', mw.optionalAuth(), (req, res) => {
    res.json({ authUser: (req as AuthenticatedRequest).authUser ?? null });
  });
  app.get('/api/protected', mw.requireAuth(), (req, res) => {
    res.json({ authUser: (req as AuthenticatedRequest).authUser });
  });
  app.get('/api/user/:userId/profile', mw.requireSelfOrResearcher(), (req, res) => {
    res.json({ ok: true, authUser: (req as AuthenticatedRequest).authUser });
  });
  app.post('/api/internal/cache/invalidate', mw.requireInternalToken(), (_req, res) => {
    res.json({ ok: true });
  });
  return { app, tokens };
}

test('requireSelfOrResearcher enforces 401/403/200 and requireInternalToken checks token or researcher JWT', async () => {
  const { app, tokens } = startTestApp();
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const r401 = await fetch(`${base}/api/user/2/profile`);
    assert.equal(r401.status, 401);

    const user1Token = tokens.sign({ userId: 1, email: 'a@b.c', name: 'A', role: 'user' });
    const r403 = await fetch(`${base}/api/user/2/profile`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(r403.status, 403);

    const r200Self = await fetch(`${base}/api/user/1/profile`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(r200Self.status, 200);

    const resToken = tokens.sign({ userId: 99, email: 'r@b.c', name: 'R', role: 'researcher' });
    const r200Researcher = await fetch(`${base}/api/user/2/profile`, {
      headers: { Authorization: `Bearer ${resToken}` },
    });
    assert.equal(r200Researcher.status, 200);

    const adminToken = tokens.sign({ userId: 100, email: 'ad@b.c', name: 'AD', role: 'admin' });
    const r200Admin = await fetch(`${base}/api/user/2/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(r200Admin.status, 200);

    const rInt401 = await fetch(`${base}/api/internal/cache/invalidate`, { method: 'POST' });
    assert.equal(rInt401.status, 401);

    const rInt200 = await fetch(`${base}/api/internal/cache/invalidate`, {
      method: 'POST',
      headers: { 'x-internal-token': 'secret-internal' },
    });
    assert.equal(rInt200.status, 200);

    const rIntRes200 = await fetch(`${base}/api/internal/cache/invalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resToken}` },
    });
    assert.equal(rIntRes200.status, 200);

    const rIntUser403 = await fetch(`${base}/api/internal/cache/invalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(rIntUser403.status, 403);
  } finally {
    server.close();
  }
});

test('JwtAuthMiddleware handles optionalAuth, expired tokens, malformed userId, and empty internal secret', async () => {
  const { app, tokens } = startTestApp('');
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const pubGuest = await fetch(`${base}/api/public`);
    assert.equal(pubGuest.status, 200);
    assert.deepEqual(await pubGuest.json(), { authUser: null });

    const pubBadToken = await fetch(`${base}/api/public`, {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    assert.equal(pubBadToken.status, 200);
    assert.deepEqual(await pubBadToken.json(), { authUser: null });

    const validToken = tokens.sign({ userId: 5, email: 'u5@b.c', name: 'U5', role: 'user' });
    const pubAuth = await fetch(`${base}/api/public`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(pubAuth.status, 200);
    assert.equal((await pubAuth.json()).authUser.userId, 5);

    const expiredToken = jwt.sign(
      { userId: 5, email: 'u5@b.c', name: 'U5', role: 'user' },
      'test-secret',
      { expiresIn: -10 }
    );
    const protExpired = await fetch(`${base}/api/protected`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(protExpired.status, 401);

    const badParam = await fetch(`${base}/api/user/abc/profile`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(badParam.status, 400);

    const badDecimalParam = await fetch(`${base}/api/user/1.5/profile`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(badDecimalParam.status, 400);

    const badSuffixParam = await fetch(`${base}/api/user/5abc/profile`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(badSuffixParam.status, 400);

    // Empty configured internalApiToken must NEVER match an empty x-internal-token header
    const emptyHeaderBypass = await fetch(`${base}/api/internal/cache/invalidate`, {
      method: 'POST',
      headers: { 'x-internal-token': '' },
    });
    assert.equal(emptyHeaderBypass.status, 401);
  } finally {
    server.close();
  }
});
