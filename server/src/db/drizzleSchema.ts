import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { Episode } from '../domain/types';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url').default('/backdrops/claude-patterson.jpg'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const movies = pgTable(
  'movies',
  {
    id: serial('id').primaryKey(),
    movielensId: integer('movielens_id').unique(),
    tmdbId: integer('tmdb_id').notNull(),
    imdbId: text('imdb_id'),
    mediaType: text('media_type').notNull().default('movie'),
    title: text('title').notNull(),
    provider: text('provider').notNull().default('NETFLIX'),
    releaseYear: integer('release_year'),
    runtimeMinutes: integer('runtime_minutes').default(110),
    ageRating: text('age_rating').default('15'),
    resolution: text('resolution').default('8K'),
    genres: text('genres')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    moods: text('moods')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    synopsis: text('synopsis').notNull().default(''),
    backdropUrl: text('backdrop_url').notNull().default(''),
    trailerYoutubeId: text('trailer_youtube_id'),
    seasonsCount: integer('seasons_count').default(1),
    episodes: jsonb('episodes')
      .$type<Episode[]>()
      .default(sql`'[]'::jsonb`),
  },
  (table) => [index('idx_movies_tmdb').on(table.tmdbId)]
);

export const ratings = pgTable(
  'ratings',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    rating: numeric('rating', { precision: 2, scale: 1 }).notNull(),
    ratedAt: timestamp('rated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.movieId] }),
    index('idx_ratings_movie').on(table.movieId),
  ]
);

export const userWatchlist = pgTable(
  'user_watchlist',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.movieId] })]
);

export const watchHistory = pgTable(
  'watch_history',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    progressSeconds: integer('progress_seconds').default(0),
    durationSeconds: integer('duration_seconds').default(0),
    progressPercent: numeric('progress_percent', {
      precision: 5,
      scale: 2,
    }).default('0'),
    lastSeason: integer('last_season').default(1),
    lastEpisode: integer('last_episode').default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.movieId] })]
);

export const drizzleSchema = {
  users,
  movies,
  ratings,
  userWatchlist,
  watchHistory,
};

export type UserRow = typeof users.$inferSelect;
export type MovieRow = typeof movies.$inferSelect;
export type RatingRow = typeof ratings.$inferSelect;
export type WatchHistoryRow = typeof watchHistory.$inferSelect;
