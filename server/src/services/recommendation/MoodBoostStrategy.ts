import { MediaEntity } from '../../domain/MediaEntity';
import {
  IScoringStrategy,
  ScoringContext,
  StrategyScoreResult,
} from './IScoringStrategy';

/**
 * Open/Closed Principle (OCP):
 * Additive mood-matching strategy extracted from orchestrator so new signals can plug in cleanly.
 */
export class MoodBoostStrategy implements IScoringStrategy {
  public readonly name = 'moodBoost';
  public readonly weight: number;

  public constructor(weight = 0.14) {
    this.weight = weight;
  }

  public score(
    candidate: MediaEntity,
    context: ScoringContext
  ): StrategyScoreResult {
    const matched =
      context.mood !== 'all' && candidate.matchesMood(context.mood);
    if (!matched) {
      return { score: 0, boost: true };
    }
    return {
      score: 1,
      boost: true,
      reason: `MATCHES ${context.mood.toUpperCase()} MOOD & ${
        candidate.genres[0] ?? 'SCI-FI'
      }`,
    };
  }
}
