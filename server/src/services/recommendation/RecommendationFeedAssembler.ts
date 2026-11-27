import { MediaEntity } from '../../domain/MediaEntity';
import {
  MoodTag,
  NavCategory,
  RecommendationFeedDTO,
  RecommendedMovieDTO,
} from '../../domain/types';
import { UserEntity } from '../../domain/UserEntity';
import { IScoringStrategy, VectorMath } from './IScoringStrategy';
import { RecommendationIndexSnapshot } from './RecommendationIndexStore';

/**
 * Single Responsibility: assembles capped Dashboard rows, hero selection, and similarity lists.
 */
export class RecommendationFeedAssembler {
  private filterByCategory(
    items: RecommendedMovieDTO[],
    category: NavCategory
  ): RecommendedMovieDTO[] {
    if (category === 'films') return items.filter((m) => m.mediaType === 'movie');
    if (category === 'shows') return items.filter((m) => m.mediaType === 'tv');
    return items;
  }

  public rankSimilarFromPool(
    target: MediaEntity,
    candidates: RecommendedMovieDTO[],
    snapshot: RecommendationIndexSnapshot,
    limit: number
  ): RecommendedMovieDTO[] {
    const tFeat =
      snapshot.featureVectors.get(target.id) ?? target.buildFeatureVector();
    const tItem = snapshot.itemVectors.get(target.id);

    return candidates
      .filter((c) => c.id !== target.id)
      .map((c) => {
        const cEntity = snapshot.mediaById.get(c.id);
        const cFeat =
          snapshot.featureVectors.get(c.id) ??
          cEntity?.buildFeatureVector() ??
          new Map<string, number>();
        const contentSim = VectorMath.cosineSimilarity(tFeat, cFeat);
        const cItem = snapshot.itemVectors.get(c.id);
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

  public assemble(params: {
    scoredPool: RecommendedMovieDTO[];
    continueWatching: RecommendedMovieDTO[];
    myList: RecommendedMovieDTO[];
    anchorMedia: MediaEntity | undefined;
    user: UserEntity;
    mood: MoodTag;
    category: NavCategory;
    snapshot: RecommendationIndexSnapshot;
    strategies: IScoringStrategy[];
    storageMode: 'postgres' | 'memory-fallback';
    tmdbEnabled: boolean;
  }): RecommendationFeedDTO {
    const {
      scoredPool,
      continueWatching,
      myList,
      anchorMedia,
      user,
      mood,
      category,
      snapshot,
      strategies,
      storageMode,
      tmdbEnabled,
    } = params;

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
      ? this.rankSimilarFromPool(anchorMedia, pool, snapshot, 8)
      : newForYou;

    const heroFeatured =
      category === 'home' && mood === 'all' && user.ratingsCount <= 2
        ? newForYou.find((m) => m.id === 1) ?? newForYou[0]
        : newForYou[0] ?? popularSuggestions[0];

    return {
      heroFeatured,
      newForYou,
      popularSuggestions,
      becauseYouWatched: anchorMedia
        ? { anchorTitle: anchorMedia.title, items: becauseItems }
        : null,
      continueWatching,
      myList,
      storageMode,
      tmdbEnabled,
      engineStats: {
        totalMovies: snapshot.mediaList.length,
        totalRatings: snapshot.totalRatings,
        userRatingsCount: user.ratingsCount,
        weights: {
          contentBased:
            strategies.find((s) => s.name === 'contentBased')?.weight ?? 0.45,
          collaborative:
            strategies.find((s) => s.name === 'collaborative')?.weight ?? 0.45,
          popularityPrior:
            strategies.find((s) => s.name === 'popularityPrior')?.weight ?? 0.1,
        },
      },
    };
  }
}
