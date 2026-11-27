import { MediaEntity } from '../../domain/MediaEntity';
import {
  IScoringStrategy,
  ScoringContext,
  StrategyScoreResult,
  VectorMath,
} from './IScoringStrategy';

/**
 * Content-Based Filtering strategy using Cosine Similarity on genres, tags, and moods.
 */
export class ContentBasedStrategy implements IScoringStrategy {
  public readonly name = 'contentBased';
  public readonly weight: number;

  public constructor(weight = 0.45) {
    this.weight = weight;
  }

  public score(
    candidate: MediaEntity,
    context: ScoringContext
  ): StrategyScoreResult {
    const features =
      context.featureVectors.get(candidate.id) ??
      candidate.buildFeatureVector();
    const rawSim = VectorMath.cosineSimilarity(
      context.userPreferenceVector,
      features
    );
    const normalized = Math.max(0, Math.min(1, (rawSim + 0.15) / 1.0));
    return { score: normalized };
  }
}
