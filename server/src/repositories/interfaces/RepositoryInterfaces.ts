import { MediaEntity } from '../../domain/MediaEntity';
import {
  MovieDTO,
  PaginatedCatalogResult,
  RatingRecord,
  SearchPaginatedParams,
  UserProfile,
  WatchProgressRecord,
} from '../../domain/types';

/**
 * Interface Segregation Principle (ISP):
 * Narrow role-based repository contracts so services depend only on the operations they use.
 */
export interface IStorageStatusProvider {
  getStorageMode(): 'postgres' | 'memory-fallback';
  getCatalogCounts(): Promise<{ movieCount: number; ratingCount: number }>;
}

export interface IMediaCatalogRepository {
  getAllMedia(): Promise<MediaEntity[]>;
  getMediaById(id: number): Promise<MediaEntity | null>;
  searchPaginated(params: SearchPaginatedParams): Promise<PaginatedCatalogResult>;
  upsertExternalMedia(dto: Omit<MovieDTO, 'id'>): Promise<MediaEntity>;
  updateMediaEnrichment(
    id: number,
    fields: Partial<
      Pick<
        MovieDTO,
        | 'backdropUrl'
        | 'synopsis'
        | 'runtimeMinutes'
        | 'trailerYoutubeId'
        | 'seasonsCount'
      >
    >
  ): Promise<void>;
}

export interface IRatingRepository {
  getAllRatings(): Promise<RatingRecord[]>;
  getUserRatings(userId: number): Promise<RatingRecord[]>;
  upsertRating(userId: number, movieId: number, rating: number): Promise<void>;
}

export interface IWatchlistRepository {
  getWatchlist(userId: number): Promise<number[]>;
  toggleWatchlist(userId: number, movieId: number): Promise<boolean>;
}

export interface IWatchHistoryRepository {
  getWatchHistory(userId: number): Promise<WatchProgressRecord[]>;
  upsertWatchProgress(
    userId: number,
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season?: number,
    episode?: number
  ): Promise<WatchProgressRecord>;
}

export interface IUserProfileRepository {
  getUserProfile(userId: number): Promise<UserProfile>;
}
