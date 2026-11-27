import { MediaEntity } from '../../domain/MediaEntity';
import {
  MoodTag,
  NavCategory,
  RecommendationFeedDTO,
  RecommendedMovieDTO,
} from '../../domain/types';
import { UserEntity } from '../../domain/UserEntity';
import { IMediaRepository } from '../../repositories/IMediaRepository';
import { TmdbApiClient } from '../TmdbApiClient';
import { CollaborativeStrategy } from './CollaborativeStrategy';
import { ContentBasedStrategy } from './ContentBasedStrategy';
import {
  IScoringStrategy,
  MediaRatingStats,
  ScoringContext,
  VectorMath,
} from './IScoringStrategy';
import { PopularityPriorStrategy } from './PopularityPriorStrategy';

interface CachedEngineIndex {
  builtAt: number;
  mediaList: MediaEntity[];
  mediaById: Map<number, MediaEntity>;
  featureVectors: Map<number, Map<string, number>>;
  itemVectors: Map<number, Map<number, number>>;
  avgMap: Map<number, MediaRatingStats>;
  topPopularIds: number[];
  totalRatings: number;
}

/**
 * Orchestrates Hybrid Recommendations by combining injected IScoringStrategy implementations
 * over a cached sparse rating/feature index.
 */
export class HybridRecommendationService {
  private readonly repository: IMediaRepository;
  private readonly tmdbClient: TmdbApiClient;
  private readonly strategies: IScoringStrategy[];
  private cachedIndex: CachedEngineIndex | null = null;

  public constructor(
    repository: IMediaRepository,
    tmdbClient: TmdbApiClient,
    strategies?: IScoringStrategy[]
  ) {
    this.repository = repository;
    this.tmdbClient = tmdbClient;
    this.strategies = strategies ?? [
      new ContentBasedStrategy(0.45),
      new CollaborativeStrategy(0.45),
      new PopularityPriorStrategy(0.1),
    ];
  }

  public invalidateCache(): void {
    this.cachedIndex = null;
  }

  private async getEngineIndex(): Promise<CachedEngineIndex> {
    if (
      this.cachedIndex &&
      Date.now() - this.cachedIndex.builtAt < 5 * 60 * 1000
    ) {
      return this.cachedIndex;
    }

    const [mediaList, allRatings] = await Promise.all([
      this.repository.getAllMedia(),
      this.repository.getAllRatings(),
    ]);

    const mediaById = new Map<number, MediaEntity>();
    const featureVectors = new Map<number, Map<string, number>>();
    for (const m of mediaList) {
      mediaById.set(m.id, m);
      featureVectors.set(m.id, m.buildFeatureVector());
    }

    const itemVectors = new Map<number, Map<number, number>>();
    const grouped = new Map<number, { sum: number; count: number }>();
    let totalSum = 0;

    for (const r of allRatings) {
      totalSum += r.rating;
      const entry = grouped.get(r.movieId) ?? { sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      grouped.set(r.movieId, entry);

      let vec = itemVectors.get(r.movieId);
      if (!vec) {
        vec = new Map<number, number>();
        itemVectors.set(r.movieId, vec);
      }
      vec.set(r.userId, r.rating - 3.0);
    }

    const globalMean = allRatings.length > 0 ? totalSum / allRatings.length : 3.8;
    const mPrior = 10;
    const avgMap = new Map<number, MediaRatingStats>();

    for (const m of mediaList) {
      const entry = grouped.get(m.id);
      const v = entry?.count ?? 0;
      const R = v > 0 ? entry!.sum / v : globalMean;
      const bayesian =
        (v / (v + mPrior)) * R + (mPrior / (v + mPrior)) * globalMean;
      avgMap.set(m.id, {
        avg: Number(R.toFixed(2)),
        count: v,
        bayesian,
      });
    }

    const topPopularIds = [...mediaList]
      .sort((a, b) => {
        const sa = avgMap.get(a.id)!;
        const sb = avgMap.get(b.id)!;
        const scoreA = sa.bayesian + (sa.count >= 15 ? 0.35 : 0);
        const scoreB = sb.bayesian + (sb.count >= 15 ? 0.35 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 260)
      .map((m) => m.id);

    this.cachedIndex = {
      builtAt: Date.now(),
      mediaList,
      mediaById,
      featureVectors,
      itemVectors,
      avgMap,
      topPopularIds,
      totalRatings: allRatings.length,
    };

    return this.cachedIndex;
  }

  private async loadUserEntity(userId: number): Promise<UserEntity> {
    const [profile, ratings, watchlistIds, watchHistory] = await Promise.all([
      this.repository.getUserProfile(userId),
      this.repository.getUserRatings(userId),
      this.repository.getWatchlist(userId),
      this.repository.getWatchHistory(userId),
    ]);
    return new UserEntity(profile, ratings, watchlistIds, watchHistory);
  }

  private filterByCategory(
    items: RecommendedMovieDTO[],
    category: NavCategory
  ): RecommendedMovieDTO[] {
    if (category === 'films') return items.filter((m) => m.mediaType === 'movie');
    if (category === 'shows') return items.filter((m) => m.mediaType === 'tv');
    return items;
  }

  private scoreCandidate(
    candidate: MediaEntity,
    context: ScoringContext,
    anchorMedia: MediaEntity | undefined,
    mood: MoodTag
  ): RecommendedMovieDTO {
    const byName = new Map<string, number>();
    let hybrid = 0;

    for (const strategy of this.strategies) {
      const { score } = strategy.score(candidate, context);
      byName.set(strategy.name, score);
      hybrid += strategy.weight * score;
    }

    const moodMatched = mood !== 'all' && candidate.matchesMood(mood);
    if (moodMatched) {
      hybrid = Math.min(1, hybrid + 0.14);
    }

    const matchScore = Math.round(Math.max(72, Math.min(99, 68 + hybrid * 31)));
    const contentScore = byName.get('contentBased') ?? 0;
    const cfScore = byName.get('collaborative') ?? 0;
    const userRating = context.user.getRatingFor(candidate.id);

    let matchReason = 'POPULAR WITH SPACE-X VOYAGERS';
    if (moodMatched) {
      matchReason = `MATCHES ${mood.toUpperCase()} MOOD & ${
        candidate.genres[0] ?? 'SCI-FI'
      }`;
    } else if (
      anchorMedia &&
      anchorMedia.id !== candidate.id &&
      cfScore >= contentScore &&
      cfScore > 0.58
    ) {
      matchReason = `SIMILAR VIEWERS TO ${anchorMedia.title} LOVED THIS`;
    } else if (
      anchorMedia &&
      anchorMedia.id !== candidate.id &&
      contentScore > 0.52
    ) {
      const sharedGenre =
        candidate.genres.find((g) => anchorMedia.genres.includes(g)) ??
        candidate.genres[0];
      matchReason = `BECAUSE YOU LIKED ${anchorMedia.title} (${
        sharedGenre || 'SCI-FI'
      })`;
    } else if (userRating !== undefined) {
      matchReason = `YOU RATED ${userRating}★`;
    }

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
    const [index, user] = await Promise.all([
      this.getEngineIndex(),
      this.loadUserEntity(userId),
    ]);

    const context: ScoringContext = {
      user,
      userPreferenceVector: user.buildPreferenceVector(index.featureVectors),
      likedSeedItems: user.getLikedSeedItems(),
      featureVectors: index.featureVectors,
      itemVectors: index.itemVectors,
      avgMap: index.avgMap,
    };

    const anchorId = user.getTopAnchorMovieId(11);
    const anchorMedia = index.mediaById.get(anchorId) ?? index.mediaList[0];

    // Candidate pre-selection for sub-50ms execution across 9,700+ MovieLens items
    const candidateIds = new Set<number>();
    for (const m of index.mediaList) {
      if (m.id <= 16 || m.mediaType === 'tv') candidateIds.add(m.id);
      if (mood !== 'all' && m.matchesMood(mood) && candidateIds.size < 360) {
        candidateIds.add(m.id);
      }
    }
    for (const id of index.topPopularIds) candidateIds.add(id);
    for (const id of user.watchlistIds) candidateIds.add(id);
    for (const h of user.historyRecords) candidateIds.add(h.movieId);
    for (const m of index.mediaList) {
      if (user.getRatingFor(m.id) !== undefined) candidateIds.add(m.id);
    }
    for (const m of index.mediaList) {
      if (candidateIds.size >= 450) break;
      const st = index.avgMap.get(m.id);
      if (st && st.count >= 20 && st.avg >= 3.9) candidateIds.add(m.id);
    }

    const scoredPool = Array.from(candidateIds)
      .map((id) => index.mediaById.get(id))
      .filter((m): m is MediaEntity => Boolean(m))
      .map((m) => this.scoreCandidate(m, context, anchorMedia, mood));

    const filteredByMood =
      mood === 'all'
        ? scoredPool
        : scoredPool.filter((m) => m.moods.includes(mood));
    const categoryFiltered = this.filterByCategory(filteredByMood, category);
    const pool =
      categoryFiltered.length > 0
        ? categoryFiltered
        : this.filterByCategory(scoredPool, category);

    const showcasePriority = new Map<number, number>([
      [1, 1],
      [2, 2],
      [6, 3],
      [3, 4],
      [7, 5],
    ]);

    const newForYou = [...pool]
      .sort((a, b) => {
        const scoreA =
          a.matchScore +
          (a.year >= 2020 ? 3 : 0) +
          (a.id <= 16 ? 5 : 0) +
          (showcasePriority.has(a.id) ? 4 : 0);
        const scoreB =
          b.matchScore +
          (b.year >= 2020 ? 3 : 0) +
          (b.id <= 16 ? 5 : 0) +
          (showcasePriority.has(b.id) ? 4 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (
          (showcasePriority.get(a.id) ?? 99) -
          (showcasePriority.get(b.id) ?? 99)
        );
      })
      .slice(0, 8);

    const popularSuggestions = [...pool]
      .sort((a, b) => {
        const popA =
          a.communityRating * 10 +
          a.matchScore * 0.4 +
          (a.ratingCount >= 20 ? 6 : 0) +
          (a.id <= 16 ? 5 : 0);
        const popB =
          b.communityRating * 10 +
          b.matchScore * 0.4 +
          (b.ratingCount >= 20 ? 6 : 0) +
          (b.id <= 16 ? 5 : 0);
        return popB - popA;
      })
      .slice(0, 8);

    const becauseItems = anchorMedia
      ? this.rankSimilarFromPool(anchorMedia, pool, index, 8)
      : newForYou;

    const continueWatching = user.historyRecords
      .map((h) => index.mediaById.get(h.movieId))
      .filter((m): m is MediaEntity => Boolean(m))
      .map((m) => this.scoreCandidate(m, context, anchorMedia, mood));

    const myList = user.watchlistIds
      .map((id) => index.mediaById.get(id))
      .filter((m): m is MediaEntity => Boolean(m))
      .map((m) => this.scoreCandidate(m, context, anchorMedia, mood));

    const heroFeatured =
      category === 'home' && mood === 'all' && user.ratingsCount <= 2
        ? newForYou.find((m) => m.id === 1) ?? newForYou[0]
        : newForYou[0] ?? popularSuggestions[0];

    const weightsObj = {
      contentBased:
        this.strategies.find((s) => s.name === 'contentBased')?.weight ?? 0.45,
      collaborative:
        this.strategies.find((s) => s.name === 'collaborative')?.weight ?? 0.45,
      popularityPrior:
        this.strategies.find((s) => s.name === 'popularityPrior')?.weight ?? 0.1,
    };

    return {
      heroFeatured,
      newForYou,
      popularSuggestions,
      becauseYouWatched: anchorMedia
        ? { anchorTitle: anchorMedia.title, items: becauseItems }
        : null,
      continueWatching,
      myList,
      storageMode: this.repository.getStorageMode(),
      tmdbEnabled: this.tmdbClient.isConfigured(),
      engineStats: {
        totalMovies: index.mediaList.length,
        totalRatings: index.totalRatings,
        userRatingsCount: user.ratingsCount,
        weights: weightsObj,
      },
    };
  }

  private rankSimilarFromPool(
    target: MediaEntity,
    candidates: RecommendedMovieDTO[],
    index: CachedEngineIndex,
    limit: number
  ): RecommendedMovieDTO[] {
    const tFeat =
      index.featureVectors.get(target.id) ?? target.buildFeatureVector();
    const tItem = index.itemVectors.get(target.id);

    return candidates
      .filter((c) => c.id !== target.id)
      .map((c) => {
        const cEntity = index.mediaById.get(c.id);
        const cFeat =
          index.featureVectors.get(c.id) ??
          cEntity?.buildFeatureVector() ??
          new Map<string, number>();
        const contentSim = VectorMath.cosineSimilarity(tFeat, cFeat);
        const cItem = index.itemVectors.get(c.id);
        const cfSim =
          tItem && cItem
            ? Math.max(0, VectorMath.cosineSimilarity(tItem, cItem))
            : 0.3;
        const hybridSim = 0.55 * contentSim + 0.45 * cfSim;
        return {
          ...c,
          matchScore: Math.round(
            Math.max(74, Math.min(99, 68 + hybridSim * 31))
          ),
          matchReason: `SIMILAR TO ${target.title}`,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  public async getSimilarMedia(
    movieId: number,
    userId = 1,
    limit = 6
  ): Promise<RecommendedMovieDTO[]> {
    const [index, user] = await Promise.all([
      this.getEngineIndex(),
      this.loadUserEntity(userId),
    ]);

    const target = index.mediaById.get(movieId);
    if (!target) return [];

    const candidates: RecommendedMovieDTO[] = [];
    for (const m of index.mediaList) {
      if (m.id === movieId) continue;
      const sharesGenre = m.genres.some((g) => target.genres.includes(g));
      if (!sharesGenre && m.id > 16 && candidates.length > 250) continue;
      const stats = index.avgMap.get(m.id) ?? {
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

    return this.rankSimilarFromPool(target, candidates, index, limit);
  }
}
