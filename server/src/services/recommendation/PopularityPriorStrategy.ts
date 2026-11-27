import { MediaEntity } from '../../domain/MediaEntity';
import {
  IScoringStrategy,
  ScoringContext,
  StrategyScoreResult,
} from './IScoringStrategy';

/**
 * Bayesian weighted community popularity prior strategy for cold-start smoothing.
 */
export class PopularityPriorStrategy implements IScoringStrategy {
  public readonly name = 'popularityPrior';
  public readonly weight: number;

  public constructor(weight = 0.1) {
    this.weight = weight;
  }

  public score(
    candidate: MediaEntity,
    context: ScoringContext
  ): StrategyScoreResult {
    const stats = context.avgMap.get(candidate.id) ?? {
      avg: 4.0,
      count: 0,
      bayesian: 4.0,
    };
    const normalized = Math.max(0, Math.min(1, (stats.bayesian - 1) / 4));
    return { score: normalized };
  }
}
