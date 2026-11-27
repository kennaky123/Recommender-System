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

    let reason: string | undefined;
    if (
      context.anchorMedia &&
      context.anchorMedia.id !== candidate.id &&
      normalized > 0.52
    ) {
      const sharedGenre =
        candidate.genres.find((g) => context.anchorMedia!.genres.includes(g)) ??
        candidate.genres[0];
      reason = `BECAUSE YOU LIKED ${context.anchorMedia.title} (${
        sharedGenre || 'SCI-FI'
      })`;
    }

    return { score: normalized, reason };
  }
}
