import { desc, sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { Episode } from '../domain/types';

// ============================================================================
// Cross-Stack JSONB & Domain Contracts (docs/backend_schema.md §4.2)
// ============================================================================

export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'late_night';

export type CabinDevice =
  | 'CABIN DISPLAY 8K'
  | 'CREW TABLET'
  | 'SPACE-X VR HEADSET';

export interface CritiqueAppliedPayload {
  maxRuntimeMinutes?: number;
  minYear?: number;
  preferHiddenGem?: boolean;
  genre?: string;
  mood?: string;
}

export interface ContextPayload {
  timeBucket?: TimeBucket;
  clientHour?: number;
  device?: CabinDevice | string;
  mood?: string;
  category?: string;
  critiqueApplied?: CritiqueAppliedPayload;
}

export interface InterleavingConfig {
  method: 'team_draft';
  algoA: string;
  algoB: string;
  firstTurn: 'A' | 'B';
  listSize: number;
}

export interface SplitConfig {
  protocol: 'temporal_global_split' | 'temporal_expanding_kfold';
  testRatio?: number;
  nFolds?: number;
  minUserRatings: number;
  relevanceThreshold: number;
  kValues: number[];
  randomSeed: number;
  excludeSynthetic: boolean;
}

export interface ExtraMetrics {
  macroUser?: Record<string, number>;
  confidenceInterval95?: Record<string, [number, number]>;
  pairedTestVsBaseline?: {
    baseline: string;
    testName: string;
    metric: string;
    tStatistic: number;
    pValue: number;
  };
  longTailShareAt10?: number;
}

// ============================================================================
// Domain A — Core VOD & User State (5 tables)
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').unique(),
    passwordHash: text('password_hash'),
    avatarUrl: text('avatar_url').default('/backdrops/claude-patterson.jpg'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    role: text('role').notNull().default('user'),
    onboardingCompleted: boolean('onboarding_completed')
      .notNull()
      .default(false),
    preferredGenres: text('preferred_genres')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    preferredMoods: text('preferred_moods')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
  },
  (table) => [
    check(
      'chk_users_role',
      sql`${table.role} IN ('user', 'researcher', 'admin')`
    ),
    uniqueIndex('idx_users_email_unique')
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL`),
    index('idx_users_real_accounts')
      .on(table.id)
      .where(sql`${table.isSynthetic} = FALSE`),
  ]
);

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
    popularityScore: doublePrecision('popularity_score').notNull().default(0),
    bayesianAvg: doublePrecision('bayesian_avg').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    tfidfNorm: doublePrecision('tfidf_norm').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_movies_tmdb').on(table.tmdbId),
    index('idx_movies_genres').using('gin', table.genres),
    index('idx_movies_type_year').on(table.mediaType, desc(table.releaseYear)),
    index('idx_movies_runtime').on(table.runtimeMinutes),
    index('idx_movies_rating_count').on(desc(table.ratingCount)),
  ]
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
    source: text('source').notNull().default('explicit_ui'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.movieId] }),
    check(
      'chk_ratings_source',
      sql`${table.source} IN ('movielens', 'explicit_ui', 'onboarding', 'persona_sim')`
    ),
    index('idx_ratings_movie').on(table.movieId),
    index('idx_ratings_rated_at').on(table.ratedAt),
    index('idx_ratings_user_time').on(table.userId, desc(table.ratedAt)),
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
    watchCount: integer('watch_count').notNull().default(1),
    completed: boolean('completed').notNull().default(false),
    lastDevice: text('last_device'),
    lastTimeBucket: text('last_time_bucket'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.movieId] }),
    check(
      'chk_watch_history_time_bucket',
      sql`${table.lastTimeBucket} IS NULL OR ${table.lastTimeBucket} IN ('morning', 'afternoon', 'evening', 'late_night')`
    ),
    index('idx_watch_history_user_recent').on(
      table.userId,
      desc(table.updatedAt)
    ),
  ]
);

// ============================================================================
// Domain B — Precomputed RecSys Model Artifacts (7 tables)
// ============================================================================

export const modelVersions = pgTable(
  'model_versions',
  {
    id: serial('id').primaryKey(),
    modelType: text('model_type').notNull(),
    versionTag: text('version_tag').notNull().unique(),
    hyperparams: jsonb('hyperparams')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    datasetSnapshot: jsonb('dataset_snapshot')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    isActive: boolean('is_active').notNull().default(false),
    trainedAt: timestamp('trained_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    trainingDurationMs: integer('training_duration_ms'),
  },
  (table) => [
    check(
      'chk_model_versions_model_type',
      sql`${table.modelType} IN ('baseline_bias', 'item_knn', 'user_knn', 'funk_svd', 'slope_one', 'tfidf_cb')`
    ),
    uniqueIndex('idx_model_versions_active_per_type')
      .on(table.modelType)
      .where(sql`${table.isActive} = TRUE`),
    index('idx_model_versions_type_time').on(
      table.modelType,
      desc(table.trainedAt)
    ),
  ]
);

export const globalModelStats = pgTable('global_model_stats', {
  modelVersionId: integer('model_version_id')
    .primaryKey()
    .references(() => modelVersions.id, { onDelete: 'cascade' }),
  globalMean: doublePrecision('global_mean').notNull(),
  totalRatings: integer('total_ratings').notNull(),
  bayesianM: doublePrecision('bayesian_m').notNull().default(10.0),
  computedAt: timestamp('computed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userBiasesAndFactors = pgTable(
  'user_biases_and_factors',
  {
    modelVersionId: integer('model_version_id')
      .notNull()
      .references(() => modelVersions.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userMean: doublePrecision('user_mean').notNull().default(0),
    userBias: doublePrecision('user_bias').notNull().default(0),
    latentFactors: real('latent_factors').array(),
    ratingCount: integer('rating_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.modelVersionId, table.userId] }),
    index('idx_user_factors_user').on(table.userId, table.modelVersionId),
  ]
);

export const itemBiasesAndFactors = pgTable(
  'item_biases_and_factors',
  {
    modelVersionId: integer('model_version_id')
      .notNull()
      .references(() => modelVersions.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    itemMean: doublePrecision('item_mean').notNull().default(0),
    itemBias: doublePrecision('item_bias').notNull().default(0),
    latentFactors: real('latent_factors').array(),
    ratingCount: integer('rating_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.modelVersionId, table.movieId] }),
    index('idx_item_factors_movie').on(table.movieId, table.modelVersionId),
  ]
);

export const itemSimilarities = pgTable(
  'item_similarities',
  {
    modelVersionId: integer('model_version_id')
      .notNull()
      .references(() => modelVersions.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    neighborMovieId: integer('neighbor_movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    similarityScore: doublePrecision('similarity_score').notNull(),
    coRatingCount: integer('co_rating_count').notNull().default(0),
    slopeOneDev: doublePrecision('slope_one_dev'),
    rankOrder: smallint('rank_order').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.modelVersionId, table.movieId, table.neighborMovieId],
    }),
    check(
      'chk_item_sim_not_self',
      sql`${table.movieId} <> ${table.neighborMovieId}`
    ),
    index('idx_item_sim_lookup').on(
      table.modelVersionId,
      table.movieId,
      table.rankOrder
    ),
  ]
);

export const userSimilarities = pgTable(
  'user_similarities',
  {
    modelVersionId: integer('model_version_id')
      .notNull()
      .references(() => modelVersions.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    neighborUserId: integer('neighbor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    similarityScore: doublePrecision('similarity_score').notNull(),
    coRatingCount: integer('co_rating_count').notNull().default(0),
    rankOrder: smallint('rank_order').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.modelVersionId, table.userId, table.neighborUserId],
    }),
    check(
      'chk_user_sim_not_self',
      sql`${table.userId} <> ${table.neighborUserId}`
    ),
    index('idx_user_sim_lookup').on(
      table.modelVersionId,
      table.userId,
      table.rankOrder
    ),
  ]
);

export const movieTfidfTerms = pgTable(
  'movie_tfidf_terms',
  {
    modelVersionId: integer('model_version_id')
      .notNull()
      .references(() => modelVersions.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    term: text('term').notNull(),
    tfidfWeight: real('tfidf_weight').notNull(),
    sourceField: text('source_field').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.modelVersionId, table.movieId, table.term],
    }),
    check(
      'chk_tfidf_source_field',
      sql`${table.sourceField} IN ('synopsis', 'genre', 'tag', 'title')`
    ),
    index('idx_tfidf_term_lookup').on(table.modelVersionId, table.term),
    index('idx_tfidf_movie_lookup').on(table.modelVersionId, table.movieId),
  ]
);

// ============================================================================
// Domain C — Silent Online Telemetry & Interleaving (3 tables)
// ============================================================================

export const recommendationSessions = pgTable(
  'recommendation_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    placement: text('placement').notNull(),
    activeStrategy: text('active_strategy').notNull(),
    contextPayload: jsonb('context_payload')
      .$type<ContextPayload>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    interleavingConfig: jsonb('interleaving_config').$type<InterleavingConfig | null>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'chk_rec_sessions_placement',
      sql`${table.placement} IN ('home_hero', 'home_for_you', 'home_because_watched', 'home_hidden_gems', 'detail_similar', 'discover_critique')`
    ),
    index('idx_rec_sessions_user_time').on(
      table.userId,
      desc(table.createdAt)
    ),
    index('idx_rec_sessions_placement_time').on(
      table.placement,
      desc(table.createdAt)
    ),
  ]
);

export const recommendationImpressions = pgTable(
  'recommendation_impressions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => recommendationSessions.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    predictedScore: doublePrecision('predicted_score'),
    matchScore: smallint('match_score'),
    assignedTeam: text('assigned_team').notNull().default('SINGLE'),
    sourceAlgorithm: text('source_algorithm').notNull(),
    explanationCode: text('explanation_code'),
    explanationText: text('explanation_text'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('chk_rec_impressions_position', sql`${table.position} >= 0`),
    check(
      'chk_rec_impressions_team',
      sql`${table.assignedTeam} IN ('A', 'B', 'SINGLE')`
    ),
    index('idx_rec_impressions_session_pos').on(
      table.sessionId,
      table.position
    ),
    index('idx_rec_impressions_movie_time').on(
      table.movieId,
      desc(table.createdAt)
    ),
  ]
);

export const interactionEvents = pgTable(
  'interaction_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => recommendationSessions.id, {
      onDelete: 'set null',
    }),
    impressionId: bigint('impression_id', { mode: 'number' }).references(
      () => recommendationImpressions.id,
      { onDelete: 'set null' }
    ),
    eventType: text('event_type').notNull(),
    eventValue: doublePrecision('event_value'),
    contextPayload: jsonb('context_payload')
      .$type<ContextPayload>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'chk_interaction_event_type',
      sql`${table.eventType} IN ('click', 'hover_focus', 'play_start', 'play_25', 'play_50', 'play_complete', 'watchlist_add', 'watchlist_remove', 'rate', 'critique_apply')`
    ),
    index('idx_interaction_session_type').on(
      table.sessionId,
      table.eventType
    ),
    index('idx_interaction_user_time').on(table.userId, desc(table.createdAt)),
    index('idx_interaction_movie_type').on(table.movieId, table.eventType),
  ]
);

// ============================================================================
// Domain D — Offline Evaluation & Persona Simulation (2 tables)
// ============================================================================

export const experimentRuns = pgTable(
  'experiment_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    experimentType: text('experiment_type').notNull(),
    splitConfig: jsonb('split_config').$type<SplitConfig>().notNull(),
    datasetStats: jsonb('dataset_stats')
      .$type<Record<string, unknown>>()
      .notNull(),
    status: text('status').notNull(),
    gitCommit: text('git_commit'),
    notes: text('notes'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'chk_experiment_type',
      sql`${table.experimentType} IN ('offline_temporal', 'offline_kfold', 'persona_simulation', 'online_interleaving_eval')`
    ),
    check(
      'chk_experiment_status',
      sql`${table.status} IN ('running', 'completed', 'failed')`
    ),
    index('idx_experiment_runs_type_time').on(
      table.experimentType,
      desc(table.startedAt)
    ),
  ]
);

export const experimentMetrics = pgTable(
  'experiment_metrics',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => experimentRuns.id, { onDelete: 'cascade' }),
    algorithmName: text('algorithm_name').notNull(),
    hyperparams: jsonb('hyperparams')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    evalK: smallint('eval_k').notNull().default(10),
    rmse: doublePrecision('rmse'),
    mae: doublePrecision('mae'),
    nmae: doublePrecision('nmae'),
    precisionAtK: doublePrecision('precision_at_k'),
    recallAtK: doublePrecision('recall_at_k'),
    f1AtK: doublePrecision('f1_at_k'),
    mrr: doublePrecision('mrr'),
    ndcgAtK: doublePrecision('ndcg_at_k'),
    catalogCoverage: doublePrecision('catalog_coverage'),
    intraListDiversity: doublePrecision('intra_list_diversity'),
    novelty: doublePrecision('novelty'),
    serendipity: doublePrecision('serendipity'),
    avgLatencyMs: doublePrecision('avg_latency_ms'),
    extraMetrics: jsonb('extra_metrics')
      .$type<ExtraMetrics>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    index('idx_experiment_metrics_run_algo').on(
      table.runId,
      table.algorithmName
    ),
  ]
);

export const drizzleSchema = {
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
};

export type UserRow = typeof users.$inferSelect;
export type MovieRow = typeof movies.$inferSelect;
export type RatingRow = typeof ratings.$inferSelect;
export type UserWatchlistRow = typeof userWatchlist.$inferSelect;
export type WatchHistoryRow = typeof watchHistory.$inferSelect;

export type ModelVersionRow = typeof modelVersions.$inferSelect;
export type GlobalModelStatsRow = typeof globalModelStats.$inferSelect;
export type UserBiasesAndFactorsRow = typeof userBiasesAndFactors.$inferSelect;
export type ItemBiasesAndFactorsRow = typeof itemBiasesAndFactors.$inferSelect;
export type ItemSimilarityRow = typeof itemSimilarities.$inferSelect;
export type UserSimilarityRow = typeof userSimilarities.$inferSelect;
export type MovieTfidfTermRow = typeof movieTfidfTerms.$inferSelect;

export type RecommendationSessionRow =
  typeof recommendationSessions.$inferSelect;
export type RecommendationImpressionRow =
  typeof recommendationImpressions.$inferSelect;
export type InteractionEventRow = typeof interactionEvents.$inferSelect;

export type ExperimentRunRow = typeof experimentRuns.$inferSelect;
export type ExperimentMetricRow = typeof experimentMetrics.$inferSelect;
