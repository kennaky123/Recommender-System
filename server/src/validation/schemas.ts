import { z } from 'zod';
import { ValidationIssue } from './RequestValidationError';

export function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
  }));
}

function emptyToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

function parseEnvBoolean(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return undefined;
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
    return value;
  }
  return value;
}

function optionalPositiveInt(defaultVal: number, maxVal?: number) {
  let numSchema = z.coerce.number().int().positive();
  if (maxVal !== undefined) {
    numSchema = numSchema.max(maxVal);
  }
  return z.preprocess(emptyToUndefined, numSchema.default(defaultVal));
}

function optionalEnum<T extends [string, ...string[]]>(
  enumSchema: z.ZodEnum<T>,
  defaultVal: T[number]
) {
  return z.preprocess(emptyToUndefined, enumSchema.default(defaultVal));
}

function optionalTrimmedString(defaultVal: string) {
  return z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).default(defaultVal)
  );
}

export const moodTagSchema = z.enum([
  'all',
  'dramatic',
  'intense',
  'fun',
  'calm',
  'mind-bending',
  'epic',
]);

export const navCategorySchema = z.enum([
  'home',
  'films',
  'shows',
  'live',
  'audio',
]);

export const catalogCategorySchema = z.enum(['all', 'films', 'shows']);
export const mediaTypeFilterSchema = z.enum(['all', 'movie', 'tv']);
export const catalogSortSchema = z.enum(['popular', 'newest', 'title']);
export const catalogSourceSchema = z.enum(['auto', 'postgres', 'tmdb']);
export const interleavingPlacementSchema = z.enum([
  'home_hero',
  'home_for_you',
  'home_because_watched',
  'home_hidden_gems',
  'detail_similar',
  'discover_critique',
]);

/**
 * Runtime environment schema validated during AppConfig initialization.
 */
export const envSchema = z.object({
  PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(5050)
  ),
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(1)
      .default('postgresql://spacex:spacex_secret@localhost:5433/spacex_vod')
  ),
  TMDB_API_KEY: z.string().trim().default(''),
  TMDB_ACCESS_TOKEN: z.string().trim().default(''),
  JWT_SECRET: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(1)
      .default('spacex_vod_dev_jwt_secret_change_me')
  ),
  JWT_EXPIRES_IN: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).default('7d')
  ),
  INTERNAL_API_TOKEN: optionalTrimmedString('spacex_internal_dev_token'),
  INTERLEAVING_ENABLED: z.preprocess(parseEnvBoolean, z.boolean().default(false)),
  INTERLEAVING_PLACEMENT: optionalEnum(
    interleavingPlacementSchema,
    'home_for_you'
  ),
  INTERLEAVING_ALGO_A: optionalTrimmedString('switching_hybrid_mmr'),
  INTERLEAVING_ALGO_B: optionalTrimmedString('funk_svd'),
});

export const registerBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be under 60 characters'),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[0-9]/, 'Password must include a number'),
});

export const loginBodySchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const listMoviesQuerySchema = z.object({
  page: optionalPositiveInt(1),
  limit: optionalPositiveInt(24, 60),
});

export const catalogQuerySchema = z.object({
  userId: optionalPositiveInt(1),
  category: optionalEnum(catalogCategorySchema, 'all'),
  mediaType: optionalEnum(mediaTypeFilterSchema, 'all'),
  genre: optionalTrimmedString('ALL'),
  mood: optionalEnum(moodTagSchema, 'all'),
  sort: optionalEnum(catalogSortSchema, 'popular'),
  page: optionalPositiveInt(1),
  limit: optionalPositiveInt(24, 60),
  source: optionalEnum(catalogSourceSchema, 'auto'),
});

export const searchQuerySchema = z.object({
  userId: optionalPositiveInt(1),
  q: z.string().optional().default(''),
  mood: optionalEnum(moodTagSchema, 'all'),
  genre: optionalTrimmedString('ALL'),
  mediaType: optionalEnum(mediaTypeFilterSchema, 'all'),
  page: optionalPositiveInt(1),
  limit: optionalPositiveInt(24, 60),
});

export const ensureMovieBodySchema = z.object({
  tmdbId: z.coerce
    .number()
    .int()
    .positive('tmdbId must be a positive integer'),
  title: z.string().trim().min(1, 'title is required'),
  movielensId: z.coerce.number().int().nullable().optional(),
  imdbId: z.string().nullable().optional(),
  mediaType: z.enum(['movie', 'tv']).optional(),
  provider: z
    .enum(['NETFLIX', 'HBOmax', 'Disney+', 'sky cinema', 'sky one'])
    .optional(),
  year: z.coerce.number().int().min(1880).max(2100).optional(),
  runtimeMinutes: z.coerce.number().int().positive().optional(),
  ageRating: z.string().optional(),
  resolution: z.enum(['8K', '4K', 'HD']).optional(),
  genres: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  moods: z.array(moodTagSchema).optional(),
  synopsis: z.string().optional(),
  backdropUrl: z.string().optional(),
  trailerYoutubeId: z.string().nullable().optional(),
  seasonsCount: z.coerce.number().int().positive().optional(),
  episodes: z
    .array(
      z.object({
        season: z.number(),
        episode: z.number(),
        title: z.string(),
        runtimeMinutes: z.number(),
        synopsis: z.string(),
        backdropUrl: z.string(),
      })
    )
    .optional(),
});

export const movieIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid movie id'),
});

export const similarMoviesQuerySchema = z.object({
  userId: optionalPositiveInt(1),
  limit: optionalPositiveInt(6, 24),
});

export const recommendationsQuerySchema = z.object({
  userId: optionalPositiveInt(1),
  mood: optionalEnum(moodTagSchema, 'all'),
  category: optionalEnum(navCategorySchema, 'home'),
});

export const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive('Invalid userId'),
});

export const watchlistToggleParamsSchema = z.object({
  userId: z.coerce.number().int().positive('Invalid userId'),
  movieId: z.coerce.number().int().positive('Invalid movieId'),
});

export const submitRatingBodySchema = z.object({
  movieId: z.coerce
    .number()
    .int()
    .positive('movieId must be a positive integer'),
  rating: z.coerce
    .number()
    .min(0.5, 'rating must be between 0.5 and 5.0')
    .max(5, 'rating must be between 0.5 and 5.0'),
});

export const watchProgressBodySchema = z.object({
  movieId: z.coerce
    .number()
    .int()
    .positive('movieId must be a positive integer'),
  progressSeconds: z.coerce
    .number()
    .min(0, 'progressSeconds must be >= 0'),
  durationSeconds: z.coerce
    .number()
    .positive('durationSeconds must be > 0'),
  season: optionalPositiveInt(1),
  episode: optionalPositiveInt(1),
});
