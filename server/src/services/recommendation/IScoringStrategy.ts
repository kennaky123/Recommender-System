import { MediaEntity } from '../../domain/MediaEntity';
import { SeedPreferenceItem, UserEntity } from '../../domain/UserEntity';

export interface MediaRatingStats {
  avg: number;
  count: number;
  bayesian: number;
}

export interface ScoringContext {
  user: UserEntity;
  userPreferenceVector: Map<string, number>;
  likedSeedItems: SeedPreferenceItem[];
  featureVectors: Map<number, Map<string, number>>;
  itemVectors: Map<number, Map<number, number>>;
  avgMap: Map<number, MediaRatingStats>;
}

export interface StrategyScoreResult {
  score: number;
}

/**
 * Strategy Pattern interface for modular recommendation scoring components.
 */
export interface IScoringStrategy {
  readonly name: string;
  readonly weight: number;
  score(candidate: MediaEntity, context: ScoringContext): StrategyScoreResult;
}

export class VectorMath {
  public static cosineSimilarity<K>(
    a: Map<K, number>,
    b: Map<K, number>
  ): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const val of a.values()) normA += val * val;
    for (const val of b.values()) normB += val * val;
    if (normA === 0 || normB === 0) return 0;

    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
    for (const [key, valA] of smaller.entries()) {
      const valB = larger.get(key);
      if (valB !== undefined) {
        dot += valA * valB;
      }
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
