import { MediaEntity } from '../../domain/MediaEntity';
import {
  IScoringStrategy,
  ScoringContext,
  StrategyScoreResult,
  VectorMath,
} from './IScoringStrategy';

/**
 * Item-Based Collaborative Filtering strategy using peer rating vector similarity.
 */
export class CollaborativeStrategy implements IScoringStrategy {
  public readonly name = 'collaborative';
  public readonly weight: number;

  public constructor(weight = 0.45) {
    this.weight = weight;
  }

  public score(
    candidate: MediaEntity,
    context: ScoringContext
  ): StrategyScoreResult {
    const targetVec = context.itemVectors.get(candidate.id);
    if (!targetVec || context.likedSeedItems.length === 0) {
      return { score: 0.45 };
    }

    let weightedSum = 0;
    let simSum = 0;

    for (const seed of context.likedSeedItems) {
      if (seed.movieId === candidate.id) continue;
      const seedVec = context.itemVectors.get(seed.movieId);
      if (!seedVec) continue;
      const sim = VectorMath.cosineSimilarity(targetVec, seedVec);
      if (sim > 0) {
        weightedSum += sim * (seed.weight / 2.5);
        simSum += sim;
      }
    }

    const score =
      simSum > 0
        ? Math.max(0, Math.min(1, 0.45 + 0.55 * (weightedSum / simSum)))
        : 0.45;

    const reason =
      context.anchorMedia &&
      context.anchorMedia.id !== candidate.id &&
      score > 0.58
        ? `SIMILAR VIEWERS TO ${context.anchorMedia.title} LOVED THIS`
        : undefined;

    return { score, reason };
  }
}
