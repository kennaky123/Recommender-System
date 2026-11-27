// server/src/config/__tests__/appConfig.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { envSchema } from '../../validation/schemas';
import { AppConfig } from '../AppConfig';

test('envSchema applies defaults for INTERNAL_API_TOKEN and INTERLEAVING_* variables', () => {
  const parsed = envSchema.parse({});
  assert.equal(parsed.INTERNAL_API_TOKEN, 'spacex_internal_dev_token');
  assert.equal(parsed.INTERLEAVING_ENABLED, false);
  assert.equal(parsed.INTERLEAVING_PLACEMENT, 'home_for_you');
  assert.equal(parsed.INTERLEAVING_ALGO_A, 'switching_hybrid_mmr');
  assert.equal(parsed.INTERLEAVING_ALGO_B, 'funk_svd');
});

test('envSchema parses INTERLEAVING_ENABLED booleans without truthy-string trap', () => {
  assert.equal(envSchema.parse({ INTERLEAVING_ENABLED: 'false' }).INTERLEAVING_ENABLED, false);
  assert.equal(envSchema.parse({ INTERLEAVING_ENABLED: 'FALSE' }).INTERLEAVING_ENABLED, false);
  assert.equal(envSchema.parse({ INTERLEAVING_ENABLED: '0' }).INTERLEAVING_ENABLED, false);
  assert.equal(envSchema.parse({ INTERLEAVING_ENABLED: '' }).INTERLEAVING_ENABLED, false);
  assert.equal(envSchema.parse({ INTERLEAVING_ENABLED: 'true' }).INTERLEAVING_ENABLED, true);
  assert.equal(envSchema.parse({ INTERLEAVING_ENABLED: '1' }).INTERLEAVING_ENABLED, true);
  assert.throws(() => envSchema.parse({ INTERLEAVING_ENABLED: 'maybe' }));
});

test('envSchema validates INTERLEAVING_PLACEMENT enum and AppConfig.fromEnv maps all fields', () => {
  assert.throws(() => envSchema.parse({ INTERLEAVING_PLACEMENT: 'invalid_slot' }));

  const cfg = AppConfig.fromEnv({
    INTERNAL_API_TOKEN: 'custom-secret-token',
    INTERLEAVING_ENABLED: 'true',
    INTERLEAVING_PLACEMENT: 'home_hidden_gems',
    INTERLEAVING_ALGO_A: 'hybrid_borda',
    INTERLEAVING_ALGO_B: 'item_knn',
  });
  assert.equal(cfg.internalApiToken, 'custom-secret-token');
  assert.equal(cfg.interleavingEnabled, true);
  assert.equal(cfg.interleavingPlacement, 'home_hidden_gems');
  assert.equal(cfg.interleavingAlgoA, 'hybrid_borda');
  assert.equal(cfg.interleavingAlgoB, 'item_knn');
});

test('envSchema treats explicit empty INTERNAL_API_TOKEN as disabled instead of dev default', () => {
  assert.equal(envSchema.parse({ INTERNAL_API_TOKEN: '' }).INTERNAL_API_TOKEN, '');
  assert.equal(envSchema.parse({ INTERNAL_API_TOKEN: '   ' }).INTERNAL_API_TOKEN, '');
  assert.equal(
    AppConfig.fromEnv({ INTERNAL_API_TOKEN: '' }).internalApiToken,
    ''
  );
  assert.equal(
    AppConfig.fromEnv({}).internalApiToken,
    'spacex_internal_dev_token'
  );
});
