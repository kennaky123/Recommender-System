export interface ScoredSignalContribution {
  weight: number;
  score: number;
  reason?: string;
  boost?: boolean;
}

/**
 * Single Responsibility: chooses the most informative explanation label from strategy outputs.
 */
export class MatchReasonExplainer {
  public explain(
    contributions: ScoredSignalContribution[],
    userRating?: number
  ): string {
    const boostReason = contributions.find(
      (c) => c.boost && c.score > 0 && Boolean(c.reason)
    )?.reason;
    if (boostReason) return boostReason;

    const topStrategyReason = [...contributions]
      .filter((c) => !c.boost && Boolean(c.reason))
      .sort((a, b) => b.score * b.weight - a.score * a.weight)[0]?.reason;
    if (topStrategyReason) return topStrategyReason;

    if (userRating !== undefined) {
      return `YOU RATED ${userRating}★`;
    }
    return 'POPULAR WITH SPACE-X VOYAGERS';
  }
}
