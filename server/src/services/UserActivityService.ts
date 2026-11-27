import {
  RecommendationFeedDTO,
  WatchProgressRecord,
} from '../domain/types';
import { IMediaRepository } from '../repositories/IMediaRepository';
import { HybridRecommendationService } from './recommendation/HybridRecommendationService';

/**
 * Application service managing user profile, ratings, watchlist, and playback progress.
 */
export class UserActivityService {
  private readonly repository: IMediaRepository;
  private readonly recommender: HybridRecommendationService;

  public constructor(
    repository: IMediaRepository,
    recommender: HybridRecommendationService
  ) {
    this.repository = repository;
    this.recommender = recommender;
  }

  public async getProfileSummary(userId: number) {
    const [profile, ratings, watchlist, watchHistory] = await Promise.all([
      this.repository.getUserProfile(userId),
      this.repository.getUserRatings(userId),
      this.repository.getWatchlist(userId),
      this.repository.getWatchHistory(userId),
    ]);

    const ratedTitles = await Promise.all(
      ratings.map(async (r) => {
        const media = await this.repository.getMediaById(r.movieId);
        return {
          ...r,
          movieTitle: media?.title ?? `Movie #${r.movieId}`,
        };
      })
    );

    return {
      profile,
      storageMode: this.repository.getStorageMode(),
      ratings: ratedTitles,
      watchlistCount: watchlist.length,
      watchHistoryCount: watchHistory.length,
    };
  }

  public async getWatchlist(userId: number): Promise<number[]> {
    return this.repository.getWatchlist(userId);
  }

  public async toggleWatchlist(
    userId: number,
    movieId: number
  ): Promise<{ inMyList: boolean; feed: RecommendationFeedDTO }> {
    const inMyList = await this.repository.toggleWatchlist(userId, movieId);
    const feed = await this.recommender.generateFeed(userId, 'all', 'home');
    return { inMyList, feed };
  }

  public async rateMedia(
    userId: number,
    movieId: number,
    rating: number
  ): Promise<{ ok: true; movieId: number; rating: number; feed: RecommendationFeedDTO }> {
    await this.repository.upsertRating(userId, movieId, rating);
    this.recommender.invalidateCache();
    const feed = await this.recommender.generateFeed(userId, 'all', 'home');
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
    const record = await this.repository.upsertWatchProgress(
      userId,
      movieId,
      progressSeconds,
      durationSeconds,
      season,
      episode
    );
    const feed = await this.recommender.generateFeed(userId, 'all', 'home');
    return { record, feed };
  }
}
