CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Domain A — Core VOD & User State (5 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  avatar_url TEXT DEFAULT '/backdrops/claude-patterson.jpg',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_genres TEXT[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_moods TEXT[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'researcher', 'admin'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_real_accounts
  ON users (id) WHERE is_synthetic = FALSE;

CREATE TABLE IF NOT EXISTS movies (
  id SERIAL PRIMARY KEY,
  movielens_id INT UNIQUE,
  tmdb_id INT NOT NULL,
  imdb_id TEXT,
  media_type TEXT NOT NULL DEFAULT 'movie',
  title TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'NETFLIX',
  release_year INT,
  runtime_minutes INT DEFAULT 110,
  age_rating TEXT DEFAULT '15',
  resolution TEXT DEFAULT '8K',
  genres TEXT[] NOT NULL DEFAULT '{}'::text[],
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  moods TEXT[] NOT NULL DEFAULT '{}'::text[],
  synopsis TEXT NOT NULL DEFAULT '',
  backdrop_url TEXT NOT NULL DEFAULT '',
  trailer_youtube_id TEXT,
  seasons_count INT DEFAULT 1,
  episodes JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE movies ADD COLUMN IF NOT EXISTS popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS bayesian_avg DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS tfidf_norm DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_movies_tmdb ON movies (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_genres ON movies USING GIN (genres);
CREATE INDEX IF NOT EXISTS idx_movies_type_year ON movies (media_type, release_year DESC);
CREATE INDEX IF NOT EXISTS idx_movies_runtime ON movies (runtime_minutes);
CREATE INDEX IF NOT EXISTS idx_movies_rating_count ON movies (rating_count DESC);

CREATE TABLE IF NOT EXISTS ratings (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  movie_id INT REFERENCES movies(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5.0),
  rated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id)
);

ALTER TABLE ratings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'explicit_ui';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ratings_source'
  ) THEN
    ALTER TABLE ratings
      ADD CONSTRAINT chk_ratings_source
      CHECK (source IN ('movielens', 'explicit_ui', 'onboarding', 'persona_sim'));
  END IF;
END $$;

UPDATE ratings r
SET source = 'movielens'
FROM users u
WHERE r.user_id = u.id
  AND u.name LIKE 'MOVIELENS USER %'
  AND u.email IS NULL
  AND r.source = 'explicit_ui';

CREATE INDEX IF NOT EXISTS idx_ratings_movie ON ratings (movie_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rated_at ON ratings (rated_at);
CREATE INDEX IF NOT EXISTS idx_ratings_user_time ON ratings (user_id, rated_at DESC);

CREATE TABLE IF NOT EXISTS user_watchlist (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  movie_id INT REFERENCES movies(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id)
);

CREATE TABLE IF NOT EXISTS watch_history (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  movie_id INT REFERENCES movies(id) ON DELETE CASCADE,
  progress_seconds INT DEFAULT 0,
  duration_seconds INT DEFAULT 0,
  progress_percent NUMERIC(5,2) DEFAULT 0,
  last_season INT DEFAULT 1,
  last_episode INT DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id)
);

ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS watch_count INT NOT NULL DEFAULT 1;
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS last_device TEXT;
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS last_time_bucket TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_watch_history_time_bucket'
  ) THEN
    ALTER TABLE watch_history
      ADD CONSTRAINT chk_watch_history_time_bucket
      CHECK (
        last_time_bucket IS NULL
        OR last_time_bucket IN ('morning', 'afternoon', 'evening', 'late_night')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_watch_history_user_recent
  ON watch_history (user_id, updated_at DESC);

-- ============================================================================
-- Domain B — Precomputed RecSys Model Artifacts (7 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_versions (
  id SERIAL PRIMARY KEY,
  model_type TEXT NOT NULL CHECK (
    model_type IN (
      'baseline_bias',
      'item_knn',
      'user_knn',
      'funk_svd',
      'slope_one',
      'tfidf_cb'
    )
  ),
  version_tag TEXT NOT NULL UNIQUE,
  hyperparams JSONB NOT NULL DEFAULT '{}'::jsonb,
  dataset_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  training_duration_ms INT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_versions_active_per_type
  ON model_versions (model_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_model_versions_type_time
  ON model_versions (model_type, trained_at DESC);

CREATE TABLE IF NOT EXISTS global_model_stats (
  model_version_id INT PRIMARY KEY REFERENCES model_versions(id) ON DELETE CASCADE,
  global_mean DOUBLE PRECISION NOT NULL,
  total_ratings INT NOT NULL,
  bayesian_m DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_biases_and_factors (
  model_version_id INT NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_mean DOUBLE PRECISION NOT NULL DEFAULT 0,
  user_bias DOUBLE PRECISION NOT NULL DEFAULT 0,
  latent_factors REAL[],
  rating_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (model_version_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_factors_user
  ON user_biases_and_factors (user_id, model_version_id);

CREATE TABLE IF NOT EXISTS item_biases_and_factors (
  model_version_id INT NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  movie_id INT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  item_mean DOUBLE PRECISION NOT NULL DEFAULT 0,
  item_bias DOUBLE PRECISION NOT NULL DEFAULT 0,
  latent_factors REAL[],
  rating_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (model_version_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_item_factors_movie
  ON item_biases_and_factors (movie_id, model_version_id);

CREATE TABLE IF NOT EXISTS item_similarities (
  model_version_id INT NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  movie_id INT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  neighbor_movie_id INT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  similarity_score DOUBLE PRECISION NOT NULL,
  co_rating_count INT NOT NULL DEFAULT 0,
  slope_one_dev DOUBLE PRECISION,
  rank_order SMALLINT NOT NULL,
  PRIMARY KEY (model_version_id, movie_id, neighbor_movie_id),
  CONSTRAINT chk_item_sim_not_self CHECK (movie_id <> neighbor_movie_id)
);

CREATE INDEX IF NOT EXISTS idx_item_sim_lookup
  ON item_similarities (model_version_id, movie_id, rank_order);

CREATE TABLE IF NOT EXISTS user_similarities (
  model_version_id INT NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  neighbor_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  similarity_score DOUBLE PRECISION NOT NULL,
  co_rating_count INT NOT NULL DEFAULT 0,
  rank_order SMALLINT NOT NULL,
  PRIMARY KEY (model_version_id, user_id, neighbor_user_id),
  CONSTRAINT chk_user_sim_not_self CHECK (user_id <> neighbor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sim_lookup
  ON user_similarities (model_version_id, user_id, rank_order);

CREATE TABLE IF NOT EXISTS movie_tfidf_terms (
  model_version_id INT NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  movie_id INT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  tfidf_weight REAL NOT NULL,
  source_field TEXT NOT NULL CHECK (
    source_field IN ('synopsis', 'genre', 'tag', 'title')
  ),
  PRIMARY KEY (model_version_id, movie_id, term)
);

CREATE INDEX IF NOT EXISTS idx_tfidf_term_lookup
  ON movie_tfidf_terms (model_version_id, term);
CREATE INDEX IF NOT EXISTS idx_tfidf_movie_lookup
  ON movie_tfidf_terms (model_version_id, movie_id);

-- ============================================================================
-- Domain C — Silent Online Telemetry & Interleaving (3 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recommendation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  placement TEXT NOT NULL CHECK (
    placement IN (
      'home_hero',
      'home_for_you',
      'home_because_watched',
      'home_hidden_gems',
      'detail_similar',
      'discover_critique'
    )
  ),
  active_strategy TEXT NOT NULL,
  context_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  interleaving_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_sessions_user_time
  ON recommendation_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_sessions_placement_time
  ON recommendation_sessions (placement, created_at DESC);

CREATE TABLE IF NOT EXISTS recommendation_impressions (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE,
  movie_id INT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position >= 0),
  predicted_score DOUBLE PRECISION,
  match_score SMALLINT,
  assigned_team TEXT NOT NULL DEFAULT 'SINGLE' CHECK (
    assigned_team IN ('A', 'B', 'SINGLE')
  ),
  source_algorithm TEXT NOT NULL,
  explanation_code TEXT,
  explanation_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_impressions_session_pos
  ON recommendation_impressions (session_id, position);
CREATE INDEX IF NOT EXISTS idx_rec_impressions_movie_time
  ON recommendation_impressions (movie_id, created_at DESC);

CREATE TABLE IF NOT EXISTS interaction_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  movie_id INT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  session_id UUID REFERENCES recommendation_sessions(id) ON DELETE SET NULL,
  impression_id BIGINT REFERENCES recommendation_impressions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'click',
      'hover_focus',
      'play_start',
      'play_25',
      'play_50',
      'play_complete',
      'watchlist_add',
      'watchlist_remove',
      'rate',
      'critique_apply'
    )
  ),
  event_value DOUBLE PRECISION,
  context_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interaction_session_type
  ON interaction_events (session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_interaction_user_time
  ON interaction_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_movie_type
  ON interaction_events (movie_id, event_type);

-- ============================================================================
-- Domain D — Offline Evaluation & Persona Simulation (2 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS experiment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  experiment_type TEXT NOT NULL CHECK (
    experiment_type IN (
      'offline_temporal',
      'offline_kfold',
      'persona_simulation',
      'online_interleaving_eval'
    )
  ),
  split_config JSONB NOT NULL,
  dataset_stats JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  git_commit TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_experiment_runs_type_time
  ON experiment_runs (experiment_type, started_at DESC);

CREATE TABLE IF NOT EXISTS experiment_metrics (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES experiment_runs(id) ON DELETE CASCADE,
  algorithm_name TEXT NOT NULL,
  hyperparams JSONB NOT NULL DEFAULT '{}'::jsonb,
  eval_k SMALLINT NOT NULL DEFAULT 10,
  rmse DOUBLE PRECISION,
  mae DOUBLE PRECISION,
  nmae DOUBLE PRECISION,
  precision_at_k DOUBLE PRECISION,
  recall_at_k DOUBLE PRECISION,
  f1_at_k DOUBLE PRECISION,
  mrr DOUBLE PRECISION,
  ndcg_at_k DOUBLE PRECISION,
  catalog_coverage DOUBLE PRECISION,
  intra_list_diversity DOUBLE PRECISION,
  novelty DOUBLE PRECISION,
  serendipity DOUBLE PRECISION,
  avg_latency_ms DOUBLE PRECISION,
  extra_metrics JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_experiment_metrics_run_algo
  ON experiment_metrics (run_id, algorithm_name);
