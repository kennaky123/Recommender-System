import {
  IAuthUserRepository,
  IMediaCatalogRepository,
  IRatingRepository,
  IStorageStatusProvider,
  IUserProfileRepository,
  IWatchHistoryRepository,
  IWatchlistRepository,
} from './interfaces/RepositoryInterfaces';

export * from './interfaces/RepositoryInterfaces';

/**
 * Composite repository interface assembled from segregated role interfaces.
 */
export interface IMediaRepository
  extends IStorageStatusProvider,
    IMediaCatalogRepository,
    IRatingRepository,
    IWatchlistRepository,
    IWatchHistoryRepository,
    IUserProfileRepository,
    IAuthUserRepository {}
