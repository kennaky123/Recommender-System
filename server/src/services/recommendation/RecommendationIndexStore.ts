import { MediaEntity } from '../../domain/MediaEntity';
import { MoodTag } from '../../domain/types';
import { UserEntity } from '../../domain/UserEntity';
import {
  IMediaCatalogRepository,
  IRatingRepository,
} from '../../repositories/interfaces/RepositoryInterfaces';
import { MediaRatingStats } from './IScoringStrategy';

export interface RecommendationIndexSnapshot {
  builtAt: number;
  mediaList: MediaEntity[];
  mediaById: Map<number, MediaEntity>;
  featureVectors: Map<number, Map<string, number>>;
  itemVectors: Map<number, Map<number, number>>;
  avgMap: Map<number, MediaRatingStats>;
  topPopularIds: number[];
  totalRatings: number;
}

/**
 * Single Responsibility: builds, caches, and pre-filters the sparse feature & rating index.
 */
export class RecommendationIndexStore {
  private readonly catalogRepo: IMediaCatalogRepository;
  private readonly ratingRepo: IRatingRepository;
  private snapshot: RecommendationIndexSnapshot | null = null;
  private static readonly TTL_MS = 5 * 60 * 1000;

  public constructor(
    catalogRepo: IMediaCatalogRepository,
    ratingRepo: IRatingRepository
  ) {
    this.catalogRepo = catalogRepo;
    this.ratingRepo = ratingRepo;
  }

  public invalidate(): void {
    this.snapshot = null;
  }

  public async getSnapshot(): Promise<RecommendationIndexSnapshot> {
    if (
      this.snapshot &&
      Date.now() - this.snapshot.builtAt < RecommendationIndexStore.TTL_MS
    ) {
      return this.snapshot;
    }

    const [mediaList, allRatings] = await Promise.all([
      this.catalogRepo.getAllMedia(),
      this.ratingRepo.getAllRatings(),
    ]);

    const mediaById = new Map<number, MediaEntity>();
    const featureVectors = new Map<number, Map<string, number>>();
    for (const m of mediaList) {
      mediaById.set(m.id, m);
      featureVectors.set(m.id, m.buildFeatureVector());
    }

    const itemVectors = new Map<number, Map<number, number>>();
    const grouped = new Map<number, { sum: number; count: number }>();
    let totalSum = 0;

    for (const r of allRatings) {
      totalSum += r.rating;
      const entry = grouped.get(r.movieId) ?? { sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      grouped.set(r.movieId, entry);

      let vec = itemVectors.get(r.movieId);
      if (!vec) {
        vec = new Map<number, number>();
        itemVectors.set(r.movieId, vec);
      }
      vec.set(r.userId, r.rating - 3.0);
    }

    const globalMean = allRatings.length > 0 ? totalSum / allRatings.length : 3.8;
    const mPrior = 10;
    const avgMap = new Map<number, MediaRatingStats>();

    for (const m of mediaList) {
      const entry = grouped.get(m.id);
      const v = entry?.count ?? 0;
      const R = v > 0 ? entry!.sum / v : globalMean;
      const bayesian =
        (v / (v + mPrior)) * R + (mPrior / (v + mPrior)) * globalMean;
      avgMap.set(m.id, {
        avg: Number(R.toFixed(2)),
        count: v,
        bayesian,
      });
    }

    const topPopularIds = [...mediaList]
      .sort((a, b) => {
        const sa = avgMap.get(a.id)!;
        const sb = avgMap.get(b.id)!;
        const scoreA = sa.bayesian + (sa.count >= 15 ? 0.35 : 0);
        const scoreB = sb.bayesian + (sb.count >= 15 ? 0.35 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 260)
      .map((m) => m.id);

    this.snapshot = {
      builtAt: Date.now(),
      mediaList,
      mediaById,
      featureVectors,
      itemVectors,
      avgMap,
      topPopularIds,
      totalRatings: allRatings.length,
    };

    return this.snapshot;
  }

  public selectCandidateMedia(
    snapshot: RecommendationIndexSnapshot,
    user: UserEntity,
    mood: MoodTag
  ): MediaEntity[] {
    const candidateIds = new Set<number>();

    for (const m of snapshot.mediaList) {
      if (m.id <= 16 || m.mediaType === 'tv') candidateIds.add(m.id);
      if (mood !== 'all' && m.matchesMood(mood) && candidateIds.size < 360) {
        candidateIds.add(m.id);
      }
    }
    for (const id of snapshot.topPopularIds) candidateIds.add(id);
    for (const id of user.watchlistIds) candidateIds.add(id);
    for (const h of user.historyRecords) candidateIds.add(h.movieId);
    for (const m of snapshot.mediaList) {
      if (user.getRatingFor(m.id) !== undefined) candidateIds.add(m.id);
    }
    for (const m of snapshot.mediaList) {
      if (candidateIds.size >= 450) break;
      const st = snapshot.avgMap.get(m.id);
      if (st && st.count >= 20 && st.avg >= 3.9) candidateIds.add(m.id);
    }

    return Array.from(candidateIds)
      .map((id) => snapshot.mediaById.get(id))
      .filter((m): m is MediaEntity => Boolean(m));
  }
}
