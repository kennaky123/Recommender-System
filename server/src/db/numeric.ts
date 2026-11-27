/**
 * Coerce PostgreSQL/Drizzle NUMERIC (returned as strings by `pg`) or unknown
 * values into finite numbers, falling back cleanly on nullish/empty/non-finite inputs.
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'bigint') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Coerce nullable/optional numeric values to a finite number or `undefined`.
 */
export function toOptionalNumber(value: unknown): number | undefined {
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}
