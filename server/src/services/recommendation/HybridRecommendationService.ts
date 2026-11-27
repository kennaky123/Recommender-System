import { MediaEntity } from '../../domain/MediaEntity';
import {
  MoodTag,
  NavCategory,
  RecommendationFeedDTO,
  RecommendedMovieDTO,
} from '../../domain/types';
import { UserEntity } from '../../domain/UserEntity';
import {
  IMediaCatalogRepository,
  IRatingRepository,
  IStorageStatusProvider,
  IUserProfileRepository,
  IWatchHistoryRepository,
  IWatchlistRepository,
} from '../../repositories/interfaces/RepositoryInterfaces';
import { IArtworkResolver } from '../ArtworkResolverService';
import {
  IExternalMediaProvider,
  IRecommendationCacheInvalidator,
  IRecommendationService,
} from '../interfaces/ServiceInterfaces';
import { IScoringStrategy, ScoringContext } from './IScoringStrategy';
import {
  MatchReasonExplainer,
  ScoredSignalContribution,
} from './MatchReasonExplainer';
import { RecommendationFeedAssembler } from './RecommendationFeedAssembler';
import {
  RecommendationIndexSnapshot,
  RecommendationIndexStore,
} from './RecommendationIndexStore';

export interface HybridRecommenderDeps {
  storageStatus: IStorageStatusProvider;
  ratingRepo: IRatingRepository;
  watchlistRepo: IWatchlistRepository;
  watchHistoryRepo: IWatchHistoryRepository;
  userProfileRepo: IUserProfileRepository;
  externalProvider: IExternalMediaProvider;
  indexStore: RecommendationIndexStore;
  explainer: MatchReasonExplainer;
  assembler: RecommendationFeedAssembler;
  strategies: IScoringStrategy[];
  artworkResolver?: IArtworkResolver;
  catalogRepo?: IMediaCatalogRepository;
}

/**
 * Clean SOLID orchestrator coordinating IndexStore, ScoringStrategies, Explainer, and FeedAssembler.
 */
export class HybridRecommendationService
  implements IRecommendationService, IRecommendationCacheInvalidator
{
  private readonly deps: HybridRecommenderDeps;

  public constructor(deps: HybridRecommenderDeps) {
    this.deps = deps;
  }

  public invalidateCache(): void {
    this.deps.indexStore.invalidate();
  }

  private async loadUserEntity(userId: number): Promise<UserEntity> {
    const [profile, ratings, watchlistIds, watchHistory] = await Promise.all([
      this.deps.userProfileRepo.getUserProfile(userId),
      this.deps.ratingRepo.getUserRatings(userId),
      this.deps.watchlistRepo.getWatchlist(userId),
      this.deps.watchHistoryRepo.getWatchHistory(userId),
    ]);
    return new UserEntity(profile, ratings, watchlistIds, watchHistory);
  }

  private scoreCandidate(
    candidate: MediaEntity,
    context: ScoringContext
  ): RecommendedMovieDTO {
    const contributions: ScoredSignalContribution[] = [];
    let hybrid = 0;

    for (const strategy of this.deps.strategies) {
      const result = strategy.score(candidate, context);
      contributions.push({
        weight: strategy.weight,
        score: result.score,
        reason: result.reason,
        boost: result.boost,
      });
      hybrid += strategy.weight * result.score;
    }

    hybrid = Math.max(0, Math.min(1, hybrid));
    const matchScore = Math.round(Math.max(72, Math.min(99, 68 + hybrid * 31)));
    const userRating = context.user.getRatingFor(candidate.id);
    const matchReason = this.deps.explainer.explain(contributions, userRating);

    const stats = context.avgMap.get(candidate.id) ?? {
      avg: 4.0,
      count: 0,
      bayesian: 4.0,
    };
    const hist = context.user.getWatchProgress(candidate.id);

    return {
      ...candidate.toDTO(),
      matchScore,
      matchReason,
      userRating,
      inMyList: context.user.isInWatchlist(candidate.id),
      progressPercent: hist?.progressPercent,
      lastSeason: hist?.lastSeason,
      lastEpisode: hist?.lastEpisode,
      communityRating: stats.avg,
      ratingCount: stats.count,
    };
  }

  public async generateFeed(
    userId: number,
    mood: MoodTag = 'all',
    category: NavCategory = 'home'
  ): Promise<RecommendationFeedDTO> {
    const [snapshot, user] = await Promise.all([
      this.deps.indexStore.getSnapshot(),
      this.loadUserEntity(userId),
    ]);

    const anchorId = user.getTopAnchorMovieId(11);
    const anchorMedia =
      snapshot.mediaById.get(anchorId) ?? snapshot.mediaList[0];

    const context: ScoringContext = {
      user,
      mood,
      anchorMedia,
      userPreferenceVector: user.buildPreferenceVector(snapshot.featureVectors),
      likedSeedItems: user.getLikedSeedItems(),
      featureVectors: snapshot.featureVectors,
      itemVectors: snapshot.itemVectors,
      avgMap: snapshot.avgMap,
    };

    const candidates = this.deps.indexStore.selectCandidateMedia(
      snapshot,
      user,
      mood
    );
    const scoredPool = candidates.map((m) => this.scoreCandidate(m, context));

    const continueWatching = user.historyRecords
      .map((h) => snapshot.mediaById.get(h.movieId))
      .filter((m): m is MediaEntity => Boolean(m))
      .map((m) => this.scoreCandidate(m, context));

    const myList = user.watchlistIds
      .map((id) => snapshot.mediaById.get(id))
      .filter((m): m is MediaEntity => Boolean(m))
      .map((m) => this.scoreCandidate(m, context));

    const feed = this.deps.assembler.assemble({
      scoredPool,
      continueWatching,
      myList,
      anchorMedia,
      user,
      mood,
      category,
      snapshot,
      strategies: this.deps.strategies,
      storageMode: this.deps.storageStatus.getStorageMode(),
      tmdbEnabled: this.deps.externalProvider.isConfigured(),
    });

    if (!this.deps.artworkResolver) {
      return feed;
    }

    const resolver = this.deps.artworkResolver;
    const persist = this.deps.catalogRepo
      ? (id: number, backdropUrl: string) =>
          this.deps.catalogRepo!.updateMediaEnrichment(id, { backdropUrl })
      : undefined;

    const allFeedItems: RecommendedMovieDTO[] = [
      feed.heroFeatured,
      ...feed.continueWatching,
      ...feed.newForYou,
      ...(feed.becauseYouWatched?.items ?? []),
      ...feed.popularSuggestions,
      ...feed.myList,
    ];
    const hydratedList = await resolver.hydrateItems(allFeedItems, persist);
    const urlById = new Map(hydratedList.map((m) => [m.id, m.backdropUrl]));
    const applyUrl = (m: RecommendedMovieDTO): RecommendedMovieDTO => {
      const nextUrl = urlById.get(m.id);
      return nextUrl && nextUrl !== m.backdropUrl
        ? { ...m, backdropUrl: nextUrl }
        : m;
    };

    return {
      ...feed,
      heroFeatured: applyUrl(feed.heroFeatured),
      continueWatching: feed.continueWatching.map(applyUrl),
      newForYou: feed.newForYou.map(applyUrl),
      becauseYouWatched: feed.becauseYouWatched
        ? {
            ...feed.becauseYouWatched,
            items: feed.becauseYouWatched.items.map(applyUrl),
          }
        : null,
      popularSuggestions: feed.popularSuggestions.map(applyUrl),
      myList: feed.myList.map(applyUrl),
    };
  }

  public async getSimilarMedia(
    movieId: number,
    userId = 1,
    limit = 6
  ): Promise<RecommendedMovieDTO[]> {
    const [snapshot, user] = await Promise.all([
      this.deps.indexStore.getSnapshot(),
      this.loadUserEntity(userId),
    ]);

    const target = snapshot.mediaById.get(movieId);
    if (!target) return [];

    const candidates = this.buildSimilarCandidatePool(target, snapshot, user);
    return this.deps.assembler.rankSimilarFromPool(
      target,
      candidates,
      snapshot,
      limit
    );
  }

  private buildSimilarCandidatePool(
    target: MediaEntity,
    snapshot: RecommendationIndexSnapshot,
    user: UserEntity
  ): RecommendedMovieDTO[] {
    const candidates: RecommendedMovieDTO[] = [];
    for (const m of snapshot.mediaList) {
      if (m.id === target.id) continue;
      const sharesGenre = m.genres.some((g) => target.genres.includes(g));
      if (!sharesGenre && m.id > 16 && candidates.length > 250) continue;
      const stats = snapshot.avgMap.get(m.id) ?? {
        avg: 4.0,
        count: 0,
        bayesian: 4.0,
      };
      const hist = user.getWatchProgress(m.id);
      candidates.push({
        ...m.toDTO(),
        matchScore: 80,
        matchReason: `SIMILAR TO ${target.title}`,
        userRating: user.getRatingFor(m.id),
        inMyList: user.isInWatchlist(m.id),
        progressPercent: hist?.progressPercent,
        lastSeason: hist?.lastSeason,
        lastEpisode: hist?.lastEpisode,
        communityRating: stats.avg,
        ratingCount: stats.count,
      });
      if (candidates.length >= 300) break;
    }
    return candidates;
  }
}
