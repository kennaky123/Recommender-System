// server/src/db/__tests__/schemaAndNumeric.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { toNumber } from '../numeric';
import { drizzleSchema } from '../drizzleSchema';

test('toNumber safely coerces PostgreSQL NUMERIC strings and handles nullish/NaN', () => {
  assert.equal(toNumber('4.5'), 4.5);
  assert.equal(toNumber('75.25'), 75.25);
  assert.equal(toNumber(null, 0), 0);
  assert.equal(toNumber(undefined, 3.8), 3.8);
  assert.equal(toNumber('not-a-number', 0), 0);
  assert.equal(typeof toNumber('4.0'), 'number');
});

test('schema.sql and drizzleSchema expose all 17 tables across 4 domains', () => {
  const sqlText = fs.readFileSync(
    path.resolve(__dirname, '..', 'schema.sql'),
    'utf-8'
  );
  const expectedTables = [
    'users', 'movies', 'ratings', 'user_watchlist', 'watch_history',
    'model_versions', 'global_model_stats', 'user_biases_and_factors',
    'item_biases_and_factors', 'item_similarities', 'user_similarities',
    'movie_tfidf_terms', 'recommendation_sessions',
    'recommendation_impressions', 'interaction_events',
    'experiment_runs', 'experiment_metrics',
  ];
  assert.match(sqlText, /CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
  assert.match(sqlText, /idx_model_versions_active_per_type/);
  for (const tbl of expectedTables) {
    assert.match(sqlText, new RegExp(`CREATE TABLE IF NOT EXISTS ${tbl}\\b`, 'i'));
  }
  assert.equal(Object.keys(drizzleSchema).length, 17);
});
