import {
  RatingRecord,
  UserProfile,
  WatchProgressRecord,
} from './types';

export interface SeedPreferenceItem {
  movieId: number;
  weight: number;
}

/**
 * Encapsulates user profile, explicit ratings, watchlist, and implicit watch history.
 */
export class UserEntity {
  public readonly profile: UserProfile;
  private readonly ratings: RatingRecord[];
  private readonly ratingMap: Map<number, number>;
  private readonly watchlistSet: Set<number>;
  private readonly watchHistory: WatchProgressRecord[];
  private readonly historyMap: Map<number, WatchProgressRecord>;

  public constructor(
    profile: UserProfile,
    ratings: RatingRecord[],
    watchlistIds: number[],
    watchHistory: WatchProgressRecord[]
  ) {
    this.profile = profile;
    this.ratings = [...ratings];
    this.ratingMap = new Map(ratings.map((r) => [r.movieId, r.rating]));
    this.watchlistSet = new Set(watchlistIds);
    this.watchHistory = [...watchHistory];
    this.historyMap = new Map(watchHistory.map((h) => [h.movieId, h]));
  }

  public get ratingsCount(): number {
    return this.ratings.length;
  }

  public get watchlistIds(): number[] {
    return Array.from(this.watchlistSet);
  }

  public get historyRecords(): WatchProgressRecord[] {
    return [...this.watchHistory];
  }

  public getRatingFor(movieId: number): number | undefined {
    return this.ratingMap.get(movieId);
  }

  public isInWatchlist(movieId: number): boolean {
    return this.watchlistSet.has(movieId);
  }

  public getWatchProgress(movieId: number): WatchProgressRecord | undefined {
    return this.historyMap.get(movieId);
  }

  public getTopAnchorMovieId(fallbackId = 11): number {
    const topRated = [...this.ratings].sort((a, b) => b.rating - a.rating)[0];
    return topRated?.movieId ?? this.watchHistory[0]?.movieId ?? fallbackId;
  }

  public getLikedSeedItems(): SeedPreferenceItem[] {
    const seeds: SeedPreferenceItem[] = [];
    for (const r of this.ratings) {
      if (r.rating >= 3.5) {
        seeds.push({ movieId: r.movieId, weight: r.rating - 2.5 });
      }
    }
    for (const h of this.watchHistory) {
      if (!this.ratingMap.has(h.movieId)) {
        seeds.push({ movieId: h.movieId, weight: 1.5 });
      }
    }
    for (const id of this.watchlistSet) {
      if (!this.ratingMap.has(id)) {
        seeds.push({ movieId: id, weight: 1.2 });
      }
    }
    return seeds;
  }

  public buildPreferenceVector(
    featureMap: Map<number, Map<string, number>>
  ): Map<string, number> {
    const profileVec = new Map<string, number>();

    const addWeighted = (movieId: number, weight: number) => {
      const fVec = featureMap.get(movieId);
      if (!fVec) return;
      for (const [feat, val] of fVec.entries()) {
        profileVec.set(feat, (profileVec.get(feat) ?? 0) + val * weight);
      }
    };

    for (const r of this.ratings) {
      addWeighted(r.movieId, r.rating - 2.5);
    }
    for (const id of this.watchlistSet) {
      addWeighted(id, 1.5);
    }
    for (const h of this.watchHistory) {
      addWeighted(h.movieId, h.progressPercent >= 50 ? 2.0 : 1.0);
    }

    return profileVec;
  }
}
