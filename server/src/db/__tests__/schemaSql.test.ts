// server/src/db/__tests__/schemaSql.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sqlText = fs.readFileSync(
  path.resolve(__dirname, '..', 'schema.sql'),
  'utf-8'
);

test('schema.sql enables pgcrypto and creates all 17 tables idempotently without destructive DDL', () => {
  assert.match(sqlText, /CREATE EXTENSION IF NOT EXISTS pgcrypto;/i);
  assert.doesNotMatch(sqlText, /\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE)\b/i);

  const expectedTables = [
    'users', 'movies', 'ratings', 'user_watchlist', 'watch_history',
    'model_versions', 'global_model_stats', 'user_biases_and_factors',
    'item_biases_and_factors', 'item_similarities', 'user_similarities',
    'movie_tfidf_terms', 'recommendation_sessions',
    'recommendation_impressions', 'interaction_events',
    'experiment_runs', 'experiment_metrics',
  ];
  for (const tbl of expectedTables) {
    assert.match(sqlText, new RegExp(`CREATE TABLE IF NOT EXISTS ${tbl}\\b`, 'i'));
  }
});

test('schema.sql preserves Domain A data via ALTER TABLE ADD COLUMN IF NOT EXISTS and idempotent CHECK blocks', () => {
  const expectedAlterColumns: Array<[string, string]> = [
    ['users', 'email'],
    ['users', 'password_hash'],
    ['users', 'role'],
    ['users', 'onboarding_completed'],
    ['users', 'preferred_genres'],
    ['users', 'preferred_moods'],
    ['users', 'is_synthetic'],
    ['movies', 'popularity_score'],
    ['movies', 'bayesian_avg'],
    ['movies', 'rating_count'],
    ['movies', 'tfidf_norm'],
    ['movies', 'updated_at'],
    ['ratings', 'source'],
    ['watch_history', 'watch_count'],
    ['watch_history', 'completed'],
    ['watch_history', 'last_device'],
    ['watch_history', 'last_time_bucket'],
  ];
  for (const [table, col] of expectedAlterColumns) {
    assert.match(
      sqlText,
      new RegExp(`ALTER TABLE ${table}\\s+ADD COLUMN IF NOT EXISTS ${col}\\b`, 'i')
    );
  }

  for (const constraintName of [
    'chk_users_role',
    'chk_ratings_source',
    'chk_watch_history_time_bucket',
  ]) {
    assert.match(
      sqlText,
      new RegExp(`SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}'`, 'i')
    );
    assert.match(
      sqlText,
      new RegExp(`ADD CONSTRAINT ${constraintName}\\b`, 'i')
    );
  }

  assert.match(sqlText, /CONSTRAINT chk_item_sim_not_self CHECK \(movie_id <> neighbor_movie_id\)/i);
  assert.match(sqlText, /CONSTRAINT chk_user_sim_not_self CHECK \(user_id <> neighbor_user_id\)/i);
  assert.match(
    sqlText,
    /UPDATE ratings[\s\S]*SET source = 'movielens'[\s\S]*u\.name LIKE 'MOVIELENS USER %'[\s\S]*u\.email IS NULL[\s\S]*r\.source = 'explicit_ui'/i
  );
});

test('schema.sql defines all required indexes including Blue-Green partial unique index', () => {
  const expectedIndexes = [
    'idx_users_email_unique',
    'idx_users_real_accounts',
    'idx_movies_tmdb',
    'idx_movies_genres',
    'idx_movies_type_year',
    'idx_movies_runtime',
    'idx_movies_rating_count',
    'idx_ratings_movie',
    'idx_ratings_rated_at',
    'idx_ratings_user_time',
    'idx_watch_history_user_recent',
    'idx_model_versions_active_per_type',
    'idx_model_versions_type_time',
    'idx_user_factors_user',
    'idx_item_factors_movie',
    'idx_item_sim_lookup',
    'idx_user_sim_lookup',
    'idx_tfidf_term_lookup',
    'idx_tfidf_movie_lookup',
    'idx_rec_sessions_user_time',
    'idx_rec_sessions_placement_time',
    'idx_rec_impressions_session_pos',
    'idx_rec_impressions_movie_time',
    'idx_interaction_session_type',
    'idx_interaction_user_time',
    'idx_interaction_movie_type',
    'idx_experiment_runs_type_time',
    'idx_experiment_metrics_run_algo',
  ];
  for (const idx of expectedIndexes) {
    assert.match(sqlText, new RegExp(`CREATE(?: UNIQUE)? INDEX IF NOT EXISTS ${idx}\\b`, 'i'));
  }
  assert.match(
    sqlText,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_model_versions_active_per_type\s+ON model_versions \(model_type\) WHERE is_active = TRUE;/i
  );
  assert.match(sqlText, /idx_movies_genres\s+ON movies USING GIN \(genres\)/i);
});
