import {
  RecommendationFeedDTO,
  WatchProgressRecord,
} from '../domain/types';
import {
  IMediaCatalogRepository,
  IRatingRepository,
  IStorageStatusProvider,
  IUserProfileRepository,
  IWatchHistoryRepository,
  IWatchlistRepository,
} from '../repositories/interfaces/RepositoryInterfaces';
import {
  IRecommendationCacheInvalidator,
  IRecommendationService,
  IUserActivityService,
} from './interfaces/ServiceInterfaces';

export interface UserActivityServiceDeps {
  storageStatus: IStorageStatusProvider;
  catalogRepo: IMediaCatalogRepository;
  ratingRepo: IRatingRepository;
  watchlistRepo: IWatchlistRepository;
  watchHistoryRepo: IWatchHistoryRepository;
  userProfileRepo: IUserProfileRepository;
  recommender: IRecommendationService;
  cacheInvalidator: IRecommendationCacheInvalidator;
}

/**
 * Application service managing user profile, ratings, watchlist, and playback progress (ISP + DIP).
 */
export class UserActivityService implements IUserActivityService {
  private readonly deps: UserActivityServiceDeps;

  public constructor(deps: UserActivityServiceDeps) {
    this.deps = deps;
  }

  public async getProfileSummary(userId: number) {
    const [profile, ratings, watchlist, watchHistory] = await Promise.all([
      this.deps.userProfileRepo.getUserProfile(userId),
      this.deps.ratingRepo.getUserRatings(userId),
      this.deps.watchlistRepo.getWatchlist(userId),
      this.deps.watchHistoryRepo.getWatchHistory(userId),
    ]);

    const ratedTitles = await Promise.all(
      ratings.map(async (r) => {
        const media = await this.deps.catalogRepo.getMediaById(r.movieId);
        return {
          ...r,
          movieTitle: media?.title ?? `Movie #${r.movieId}`,
        };
      })
    );

    return {
      profile,
      storageMode: this.deps.storageStatus.getStorageMode(),
      ratings: ratedTitles,
      watchlistCount: watchlist.length,
      watchHistoryCount: watchHistory.length,
    };
  }

  public async getWatchlist(userId: number): Promise<number[]> {
    return this.deps.watchlistRepo.getWatchlist(userId);
  }

  public async toggleWatchlist(
    userId: number,
    movieId: number
  ): Promise<{ inMyList: boolean; feed: RecommendationFeedDTO }> {
    const inMyList = await this.deps.watchlistRepo.toggleWatchlist(
      userId,
      movieId
    );
    const feed = await this.deps.recommender.generateFeed(userId, 'all', 'home');
    return { inMyList, feed };
  }

  public async rateMedia(
    userId: number,
    movieId: number,
    rating: number
  ): Promise<{
    ok: true;
    movieId: number;
    rating: number;
    feed: RecommendationFeedDTO;
  }> {
    await this.deps.ratingRepo.upsertRating(userId, movieId, rating);
    this.deps.cacheInvalidator.invalidateCache();
    const feed = await this.deps.recommender.generateFeed(userId, 'all', 'home');
    return { ok: true, movieId, rating, feed };
  }

  public async recordWatchProgress(
    userId: number,
    movieId: number,
    progressSeconds: number,
    durationSeconds: number,
    season = 1,
    episode = 1
  ): Promise<{ record: WatchProgressRecord; feed: RecommendationFeedDTO }> {
    const record = await this.deps.watchHistoryRepo.upsertWatchProgress(
      userId,
      movieId,
      progressSeconds,
      durationSeconds,
      season,
      episode
    );
    const feed = await this.deps.recommender.generateFeed(userId, 'all', 'home');
    return { record, feed };
  }
}
