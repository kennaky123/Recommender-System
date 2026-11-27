// server/src/db/__tests__/drizzleSchema.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  drizzleSchema,
  users,
  movies,
  ratings,
  userWatchlist,
  watchHistory,
  modelVersions,
  globalModelStats,
  userBiasesAndFactors,
  itemBiasesAndFactors,
  itemSimilarities,
  userSimilarities,
  movieTfidfTerms,
  recommendationSessions,
  recommendationImpressions,
  interactionEvents,
  experimentRuns,
  experimentMetrics,
} from '../drizzleSchema';

test('drizzleSchema exports all 17 tables mapped to exact PostgreSQL table names', () => {
  assert.equal(Object.keys(drizzleSchema).length, 17);
  const pairs: Array<[unknown, string]> = [
    [users, 'users'],
    [movies, 'movies'],
    [ratings, 'ratings'],
    [userWatchlist, 'user_watchlist'],
    [watchHistory, 'watch_history'],
    [modelVersions, 'model_versions'],
    [globalModelStats, 'global_model_stats'],
    [userBiasesAndFactors, 'user_biases_and_factors'],
    [itemBiasesAndFactors, 'item_biases_and_factors'],
    [itemSimilarities, 'item_similarities'],
    [userSimilarities, 'user_similarities'],
    [movieTfidfTerms, 'movie_tfidf_terms'],
    [recommendationSessions, 'recommendation_sessions'],
    [recommendationImpressions, 'recommendation_impressions'],
    [interactionEvents, 'interaction_events'],
    [experimentRuns, 'experiment_runs'],
    [experimentMetrics, 'experiment_metrics'],
  ];
  for (const [tbl, expectedName] of pairs) {
    const cfg = getTableConfig(tbl as Parameters<typeof getTableConfig>[0]);
    assert.equal(cfg.name, expectedName);
  }
});

test('Domain A tables include all backward-compatible extension columns and constraints', () => {
  const usersCfg = getTableConfig(users);
  assert.deepEqual(
    usersCfg.columns.map((c) => c.name),
    [
      'id', 'name', 'email', 'password_hash', 'avatar_url', 'created_at',
      'role', 'onboarding_completed', 'preferred_genres', 'preferred_moods', 'is_synthetic',
    ]
  );
  assert.ok(usersCfg.checks.some((c) => c.name === 'chk_users_role'));

  const moviesCfg = getTableConfig(movies);
  assert.equal(moviesCfg.columns.length, 24);
  for (const col of ['popularity_score', 'bayesian_avg', 'rating_count', 'tfidf_norm', 'updated_at']) {
    assert.ok(moviesCfg.columns.some((c) => c.name === col), `missing movies.${col}`);
  }
  assert.ok(moviesCfg.indexes.some((i) => i.config.name === 'idx_movies_genres'));

  const ratingsCfg = getTableConfig(ratings);
  assert.ok(ratingsCfg.columns.some((c) => c.name === 'source'));
  assert.ok(ratingsCfg.checks.some((c) => c.name === 'chk_ratings_source'));

  const whCfg = getTableConfig(watchHistory);
  for (const col of ['watch_count', 'completed', 'last_device', 'last_time_bucket']) {
    assert.ok(whCfg.columns.some((c) => c.name === col), `missing watch_history.${col}`);
  }
  assert.ok(whCfg.checks.some((c) => c.name === 'chk_watch_history_time_bucket'));
});

test('Domain B/C/D use number-mode bigints, real[] factors, partial unique active index, and correct FK actions', () => {
  const mvCfg = getTableConfig(modelVersions);
  const activeIdx = mvCfg.indexes.find((i) => i.config.name === 'idx_model_versions_active_per_type');
  assert.ok(activeIdx, 'missing idx_model_versions_active_per_type');
  assert.equal(activeIdx.config.unique, true);
  assert.ok(activeIdx.config.where, 'idx_model_versions_active_per_type must be partial');

  const ufCfg = getTableConfig(userBiasesAndFactors);
  const uLatent = ufCfg.columns.find((c) => c.name === 'latent_factors');
  assert.equal(uLatent?.getSQLType(), 'real[]');

  const impCfg = getTableConfig(recommendationImpressions);
  const impId = impCfg.columns.find((c) => c.name === 'id');
  assert.equal(impId?.dataType, 'number');
  assert.equal(impId?.getSQLType(), 'bigserial');

  const evCfg = getTableConfig(interactionEvents);
  const evId = evCfg.columns.find((c) => c.name === 'id');
  const evImpId = evCfg.columns.find((c) => c.name === 'impression_id');
  assert.equal(evId?.dataType, 'number');
  assert.equal(evImpId?.dataType, 'number');
  assert.equal(evImpId?.getSQLType(), 'bigint');

  const impFk = evCfg.foreignKeys.find((fk) =>
    fk.reference().columns.some((c) => c.name === 'impression_id')
  );
  assert.equal(impFk?.onDelete, 'set null');

  const emCfg = getTableConfig(experimentMetrics);
  const emId = emCfg.columns.find((c) => c.name === 'id');
  assert.equal(emId?.dataType, 'number');

  const itemSimCfg = getTableConfig(itemSimilarities);
  assert.ok(itemSimCfg.checks.some((c) => c.name === 'chk_item_sim_not_self'));
  const userSimCfg = getTableConfig(userSimilarities);
  assert.ok(userSimCfg.checks.some((c) => c.name === 'chk_user_sim_not_self'));
});
