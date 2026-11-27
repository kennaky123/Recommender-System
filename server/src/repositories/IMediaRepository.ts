import { MediaEntity } from '../domain/MediaEntity';
import {
  MovieDTO,
  PaginatedCatalogResult,
  RatingRecord,
  SearchPaginatedParams,
  UserProfile,
  WatchProgressRecord,
} from '../domain/types';

/**
 * Repository contract abstracting persistence away from business services (DIP).
 */
export interface IMediaRepository {
  getStorageMode(): 'postgres' | 'memory-fallback';
  getCatalogCounts(): Promise<{ movieCount: number; ratingCount: number }>;
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
  getAllRatings(): Promise<RatingRecord[]>;
  getUserRatings(userId: number): Promise<RatingRecord[]>;
  upsertRating(userId: number, movieId: number, rating: number): Promise<void>;
  getWatchlist(userId: number): Promise<number[]>;
  toggleWatchlist(userId: number, movieId: number): Promise<boolean>;
  getWatchHistory(userId: number): Promise<WatchProgressRecord[]>;
  upsertWatchProgress(
    userId: number,
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season?: number,
    episode?: number
  ): Promise<WatchProgressRecord>;
  getUserProfile(userId: number): Promise<UserProfile>;
}
