import { MediaEntity } from '../../domain/MediaEntity';
import {
  AuthResponseDTO,
  CatalogSort,
  MoodTag,
  MovieDTO,
  NavCategory,
  PaginatedCatalogResult,
  PublicUserDTO,
  RecommendationFeedDTO,
  RecommendedMovieDTO,
  WatchProgressRecord,
} from '../../domain/types';

export interface SearchQueryInput {
  userId: number;
  query: string;
  mood: MoodTag;
  genre: string;
  mediaType: 'all' | 'movie' | 'tv';
  page: number;
  limit: number;
}

export interface CatalogQueryInput {
  userId: number;
  category: string;
  mediaType: 'all' | 'movie' | 'tv';
  genre: string;
  mood: MoodTag;
  sort: CatalogSort;
  page: number;
  limit: number;
  source: string;
}

export interface IExternalMediaProvider {
  isConfigured(): boolean;
  searchMulti(
    query: string,
    page?: number,
    mediaType?: 'all' | 'movie' | 'tv'
  ): Promise<{ items: MediaEntity[]; total: number; totalPages: number }>;
  fetchPopular(
    mediaType?: 'all' | 'movie' | 'tv',
    page?: number
  ): Promise<{ items: MediaEntity[]; total: number; totalPages: number }>;
  enrichMedia(entity: MediaEntity): Promise<MediaEntity>;
}

export interface IRecommendationCacheInvalidator {
  invalidateCache(): void;
}

export interface IRecommendationService {
  generateFeed(
    userId: number,
    mood?: MoodTag,
    category?: NavCategory
  ): Promise<RecommendationFeedDTO>;
  getSimilarMedia(
    movieId: number,
    userId?: number,
    limit?: number
  ): Promise<RecommendedMovieDTO[]>;
}

export interface ICatalogService {
  getHealthSnapshot(): Promise<{
    storageMode: 'postgres' | 'memory-fallback';
    tmdbEnabled: boolean;
    movieCount: number;
    ratingCount: number;
  }>;
  getCatalog(input: CatalogQueryInput): Promise<PaginatedCatalogResult>;
  search(input: SearchQueryInput): Promise<{
    movies: RecommendedMovieDTO[];
    total: number;
    page: number;
    totalPages: number;
    tmdbEnabled: boolean;
    sourcesUsed: string[];
  }>;
  ensureExternalMedia(payload: Partial<MovieDTO>): Promise<RecommendedMovieDTO>;
  getMediaDetails(id: number): Promise<MovieDTO | null>;
  getSimilar(
    movieId: number,
    userId?: number,
    limit?: number
  ): Promise<RecommendedMovieDTO[]>;
}

export interface IUserActivityService {
  getProfileSummary(userId: number): Promise<unknown>;
  getWatchlist(userId: number): Promise<number[]>;
  toggleWatchlist(
    userId: number,
    movieId: number
  ): Promise<{ inMyList: boolean; feed: RecommendationFeedDTO }>;
  rateMedia(
    userId: number,
    movieId: number,
    rating: number
  ): Promise<{
    ok: true;
    movieId: number;
    rating: number;
    feed: RecommendationFeedDTO;
  }>;
  recordWatchProgress(
    userId: number,
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season?: number,
    episode?: number
  ): Promise<{ record: WatchProgressRecord; feed: RecommendationFeedDTO }>;
}

export interface IPasswordHasher {
  hash(plainPassword: string): string;
  verify(plainPassword: string, storedHash: string): boolean;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  name: string;
}

export interface ITokenProvider {
  sign(payload: AuthTokenPayload): string;
  verify(token: string): AuthTokenPayload;
}

export interface IAuthService {
  register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthResponseDTO>;
  login(input: { email: string; password: string }): Promise<AuthResponseDTO>;
  getCurrentUser(token: string): Promise<PublicUserDTO>;
}
