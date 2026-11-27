/**
 * Domain Value Objects enforcing consistent invariants across all repository substitutes (LSP).
 */
export class RatingValue {
  public readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  public static create(raw: number): RatingValue {
    if (!Number.isFinite(raw)) {
      throw new Error('Rating must be a finite number');
    }
    const clamped = Math.max(0.5, Math.min(5.0, Math.round(raw * 2) / 2));
    return new RatingValue(clamped);
  }
}

export class WatchProgressValue {
  public readonly progressSeconds: number;
  public readonly durationSeconds: number;
  public readonly progressPercent: number;

  private constructor(
    progressSeconds: number,
    durationSeconds: number,
    progressPercent: number
  ) {
    this.progressSeconds = progressSeconds;
    this.durationSeconds = durationSeconds;
    this.progressPercent = progressPercent;
  }

  public static create(
    rawProgressSeconds: number,
    rawDurationSeconds: number
  ): WatchProgressValue {
    const safeDuration = Math.max(1, Math.round(rawDurationSeconds));
    const safeProgress = Math.max(
      0,
      Math.min(safeDuration, Math.round(rawProgressSeconds))
    );
    const progressPercent = Number(
      Math.min(100, (safeProgress / safeDuration) * 100).toFixed(2)
    );
    return new WatchProgressValue(safeProgress, safeDuration, progressPercent);
  }
}
