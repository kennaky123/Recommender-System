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
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email) WHERE email IS NOT NULL;

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
  genres TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  moods TEXT[] NOT NULL DEFAULT '{}',
  synopsis TEXT NOT NULL DEFAULT '',
  backdrop_url TEXT NOT NULL DEFAULT '',
  trailer_youtube_id TEXT,
  seasons_count INT DEFAULT 1,
  episodes JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS ratings (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  movie_id INT REFERENCES movies(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5.0),
  rated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id)
);

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

CREATE INDEX IF NOT EXISTS idx_movies_tmdb ON movies (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_genres ON movies USING GIN (genres);
CREATE INDEX IF NOT EXISTS idx_ratings_movie ON ratings (movie_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_recent ON watch_history (user_id, updated_at DESC);
