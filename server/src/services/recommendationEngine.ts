import { DataStore } from '../db/store';
import {
  MoodTag,
  Movie,
  NavCategory,
  RatingRecord,
  RecommendationFeed,
  RecommendedMovie,
  WatchProgressRecord,
} from '../types';

const WEIGHTS = {
  contentBased: 0.45,
  collaborative: 0.45,
  popularityPrior: 0.1,
};

function buildFeatureVector(movie: Movie): Map<string, number> {
  const vec = new Map<string, number>();
  for (const g of movie.genres) {
    vec.set(`genre:${g.toUpperCase()}`, 1.4);
  }
  for (const t of movie.tags) {
    vec.set(`tag:${t.toLowerCase()}`, 1.0);
  }
  for (const m of movie.moods) {
    vec.set(`mood:${m.toLowerCase()}`, 0.9);
  }
  return vec;
}

function cosineSimilarity<K>(a: Map<K, number>, b: Map<K, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const val of a.values()) normA += val * val;
  for (const val of b.values()) normB += val * val;
  if (normA === 0 || normB === 0) return 0;

  for (const [key, valA] of a.entries()) {
    const valB = b.get(key);
    if (valB !== undefined) {
      dot += valA * valB;
    }
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function buildItemRatingVectors(
  ratings: RatingRecord[]
): Map<number, Map<number, number>> {
  const itemUsers = new Map<number, Map<number, number>>();
  for (const r of ratings) {
    let map = itemUsers.get(r.movieId);
    if (!map) {
      map = new Map<number, number>();
      itemUsers.set(r.movieId, map);
    }
    // Center ratings around neutral 3.0 so likes (+2) and dislikes (-2) separate cleanly
    map.set(r.userId, r.rating - 3.0);
  }
  return itemUsers;
}

function computeCommunityStats(
  movies: Movie[],
  ratings: RatingRecord[]
): {
  avgMap: Map<number, { avg: number; count: number; bayesian: number }>;
  globalMean: number;
} {
  const grouped = new Map<number, { sum: number; count: number }>();
  let totalSum = 0;
  for (const r of ratings) {
    totalSum += r.rating;
    const entry = grouped.get(r.movieId) ?? { sum: 0, count: 0 };
    entry.sum += r.rating;
    entry.count += 1;
    grouped.set(r.movieId, entry);
  }
  const globalMean = ratings.length > 0 ? totalSum / ratings.length : 4.0;
  const mPrior = 4; // smoothing factor for small catalog
  const avgMap = new Map<number, { avg: number; count: number; bayesian: number }>();

  for (const movie of movies) {
    const entry = grouped.get(movie.id);
    const v = entry?.count ?? 0;
    const R = v > 0 ? entry!.sum / v : globalMean;
    const bayesian = (v / (v + mPrior)) * R + (mPrior / (v + mPrior)) * globalMean;
    avgMap.set(movie.id, {
      avg: Number(R.toFixed(2)),
      count: v,
      bayesian,
    });
  }
  return { avgMap, globalMean };
}

function filterByCategory(movies: Movie[], category: NavCategory): Movie[] {
  if (category === 'films') {
    return movies.filter((m) => m.mediaType === 'movie');
  }
  if (category === 'shows') {
    return movies.filter((m) => m.mediaType === 'tv');
  }
  return movies;
}

export async function generateRecommendations(
  store: DataStore,
  userId: number,
  mood: MoodTag = 'all',
  category: NavCategory = 'home'
): Promise<RecommendationFeed> {
  const [allMovies, allRatings, userRatings, watchlistIds, watchHistory] =
    await Promise.all([
      store.getMovies(),
      store.getAllRatings(),
      store.getUserRatings(userId),
      store.getWatchlist(userId),
      store.getWatchHistory(userId),
    ]);

  const featureVectors = new Map<number, Map<string, number>>();
  for (const m of allMovies) {
    featureVectors.set(m.id, buildFeatureVector(m));
  }

  const userRatingMap = new Map<number, number>(
    userRatings.map((r) => [r.movieId, r.rating])
  );
  const watchlistSet = new Set<number>(watchlistIds);
  const historyMap = new Map<number, WatchProgressRecord>(
    watchHistory.map((h) => [h.movieId, h])
  );

  // Build User Content Profile Vector from ratings + watchlist + watch progress
  const userProfileVec = new Map<string, number>();
  const addWeightedFeatures = (movieId: number, weight: number) => {
    const fVec = featureVectors.get(movieId);
    if (!fVec) return;
    for (const [feat, val] of fVec.entries()) {
      userProfileVec.set(feat, (userProfileVec.get(feat) ?? 0) + val * weight);
    }
  };

  for (const r of userRatings) {
    // Center around 2.5 so 3★+ contributes positively and <=2★ shifts away
    addWeightedFeatures(r.movieId, r.rating - 2.5);
  }
  for (const mId of watchlistIds) {
    addWeightedFeatures(mId, 1.5);
  }
  for (const h of watchHistory) {
    const implicitWeight = h.progressPercent >= 50 ? 2.0 : 1.0;
    addWeightedFeatures(h.movieId, implicitWeight);
  }

  // Build Item-Based Collaborative Filtering vectors (excluding active user's own ratings for peer signal)
  const peerRatings = allRatings.filter((r) => r.userId !== userId);
  const itemVectors = buildItemRatingVectors(peerRatings);
  const { avgMap } = computeCommunityStats(allMovies, allRatings);

  // Anchor movie for "BECAUSE YOU WATCHED / RATED"
  const topRatedAnchorId =
    [...userRatings].sort((a, b) => b.rating - a.rating)[0]?.movieId ??
    watchHistory[0]?.movieId ??
    11;
  const anchorMovie = allMovies.find((m) => m.id === topRatedAnchorId) ?? allMovies[0];

  // Positive preference seed items (explicit ratings >= 3.5 or watch history / watchlist)
  const likedSeedItems: Array<{ movieId: number; weight: number }> = [];
  for (const r of userRatings) {
    if (r.rating >= 3.5) likedSeedItems.push({ movieId: r.movieId, weight: r.rating - 2.5 });
  }
  for (const h of watchHistory) {
    if (!userRatingMap.has(h.movieId)) {
      likedSeedItems.push({ movieId: h.movieId, weight: 1.5 });
    }
  }
  for (const wId of watchlistIds) {
    if (!userRatingMap.has(wId)) {
      likedSeedItems.push({ movieId: wId, weight: 1.2 });
    }
  }

  const scoredAll: RecommendedMovie[] = allMovies.map((movie) => {
    // 1. Content-Based score [0..1]
    const mFeatures = featureVectors.get(movie.id)!;
    const rawContentSim = cosineSimilarity(userProfileVec, mFeatures);
    const contentScore = Math.max(0, Math.min(1, (rawContentSim + 0.15) / 1.0));

    // 2. Item-Based Collaborative Filtering score [0..1]
    let cfWeightedSum = 0;
    let cfSimSum = 0;
    const targetItemVec = itemVectors.get(movie.id);
    if (targetItemVec && likedSeedItems.length > 0) {
      for (const seed of likedSeedItems) {
        if (seed.movieId === movie.id) continue;
        const seedVec = itemVectors.get(seed.movieId);
        if (!seedVec) continue;
        const sim = cosineSimilarity(targetItemVec, seedVec);
        if (sim > 0) {
          cfWeightedSum += sim * (seed.weight / 2.5);
          cfSimSum += sim;
        }
      }
    }
    const cfScore =
      cfSimSum > 0
        ? Math.max(0, Math.min(1, 0.45 + 0.55 * (cfWeightedSum / cfSimSum)))
        : 0.45;

    // 3. Bayesian Popularity Prior [0..1]
    const stats = avgMap.get(movie.id) ?? { avg: 4.0, count: 0, bayesian: 4.0 };
    const popScore = Math.max(0, Math.min(1, (stats.bayesian - 1) / 4));

    // Hybrid combination
    let hybrid =
      WEIGHTS.contentBased * contentScore +
      WEIGHTS.collaborative * cfScore +
      WEIGHTS.popularityPrior * popScore;

    const moodMatched = mood !== 'all' && movie.moods.includes(mood);
    if (moodMatched) {
      hybrid = Math.min(1, hybrid + 0.14);
    }

    const matchScore = Math.round(Math.max(72, Math.min(99, 68 + hybrid * 31)));

    // Explainable match reason
    let matchReason = 'POPULAR WITH SPACE-X VOYAGERS';
    if (moodMatched) {
      matchReason = `MATCHES ${mood.toUpperCase()} MOOD & ${movie.genres[0] ?? 'SCI-FI'}`;
    } else if (
      anchorMovie &&
      anchorMovie.id !== movie.id &&
      cfScore >= contentScore &&
      cfScore > 0.58
    ) {
      matchReason = `SIMILAR VIEWERS TO ${anchorMovie.title} LOVED THIS`;
    } else if (anchorMovie && anchorMovie.id !== movie.id && contentScore > 0.52) {
      const sharedGenre =
        movie.genres.find((g) => anchorMovie.genres.includes(g)) ?? movie.genres[0];
      matchReason = `BECAUSE YOU LIKED ${anchorMovie.title} (${sharedGenre || 'SCI-FI'})`;
    } else if (userRatingMap.has(movie.id)) {
      matchReason = `YOU RATED ${userRatingMap.get(movie.id)}★`;
    }

    const hist = historyMap.get(movie.id);

    return {
      ...movie,
      matchScore,
      matchReason,
      userRating: userRatingMap.get(movie.id),
      inMyList: watchlistSet.has(movie.id),
      progressPercent: hist?.progressPercent,
      lastSeason: hist?.lastSeason,
      lastEpisode: hist?.lastEpisode,
      communityRating: stats.avg,
      ratingCount: stats.count,
    };
  });

  const filteredMovies = filterByCategory(
    mood === 'all' ? scoredAll : scoredAll.filter((m) => m.moods.includes(mood)),
    category
  ) as RecommendedMovie[];

  const poolMovies =
    filteredMovies.length > 0 ? filteredMovies : (filterByCategory(scoredAll, category) as RecommendedMovie[]);

  // Preserve Behance showcase lead order on initial neutral home state while letting real user actions re-rank dynamically
  const showcasePriority = new Map<number, number>([
    [1, 1], // BLACK SUMMER
    [2, 2], // FINAL SPACE
    [6, 3], // ZACK SNYDER'S JUSTICE LEAGUE
    [3, 4], // LOKI
    [7, 5], // NOBODY
  ]);

  const sortedByMatch = [...poolMovies].sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return (showcasePriority.get(a.id) ?? 99) - (showcasePriority.get(b.id) ?? 99);
  });

  // NEW FOR YOU: showcases fresh personalized picks (starts with Black Summer in Home neutral mode, or top personalized match after interaction)
  const newForYou = [...poolMovies]
    .sort((a, b) => {
      const scoreA = a.matchScore + (a.year >= 2020 ? 3 : 0) + (showcasePriority.has(a.id) ? 4 : 0);
      const scoreB = b.matchScore + (b.year >= 2020 ? 3 : 0) + (showcasePriority.has(b.id) ? 4 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (showcasePriority.get(a.id) ?? 99) - (showcasePriority.get(b.id) ?? 99);
    })
    .slice(0, 8);

  // POPULAR SUGGESTIONS FOR YOU: high Bayesian community rating + hybrid blend
  const popularSuggestions = [...poolMovies]
    .sort((a, b) => {
      const popA = a.communityRating * 10 + a.matchScore * 0.4 + (a.id === 4 || a.id === 8 || a.id === 9 || a.id === 10 || a.id === 5 ? 6 : 0);
      const popB = b.communityRating * 10 + b.matchScore * 0.4 + (b.id === 4 || b.id === 8 || b.id === 9 || b.id === 10 || b.id === 5 ? 6 : 0);
      return popB - popA;
    })
    .slice(0, 8);

  const becauseItems = anchorMovie
    ? getSimilarFromScored(anchorMovie, poolMovies, featureVectors, itemVectors, 6)
    : sortedByMatch.slice(0, 6);

  const continueWatching = watchHistory
    .map((h) => scoredAll.find((m) => m.id === h.movieId))
    .filter((m): m is RecommendedMovie => Boolean(m));

  const myList = watchlistIds
    .map((id) => scoredAll.find((m) => m.id === id))
    .filter((m): m is RecommendedMovie => Boolean(m));

  // Hero featured: Black Summer on initial neutral Home state (faithful to Behance Module 0/17/18/20), or top match when filtered
  const heroFeatured =
    category === 'home' && mood === 'all' && userRatings.length <= 2
      ? newForYou.find((m) => m.id === 1) ?? newForYou[0]
      : newForYou[0] ?? sortedByMatch[0];

  return {
    heroFeatured,
    newForYou,
    popularSuggestions,
    becauseYouWatched: anchorMovie
      ? {
          anchorTitle: anchorMovie.title,
          items: becauseItems,
        }
      : null,
    continueWatching,
    myList,
    storageMode: store.getStorageMode(),
    engineStats: {
      totalMovies: allMovies.length,
      totalRatings: allRatings.length,
      userRatingsCount: userRatings.length,
      weights: WEIGHTS,
    },
  };
}

function getSimilarFromScored(
  target: Movie,
  candidates: RecommendedMovie[],
  featureVectors: Map<number, Map<string, number>>,
  itemVectors: Map<number, Map<number, number>>,
  limit: number
): RecommendedMovie[] {
  const tFeat = featureVectors.get(target.id) ?? buildFeatureVector(target);
  const tItem = itemVectors.get(target.id);

  return candidates
    .filter((c) => c.id !== target.id)
    .map((c) => {
      const cFeat = featureVectors.get(c.id) ?? buildFeatureVector(c);
      const contentSim = cosineSimilarity(tFeat, cFeat);
      const cItem = itemVectors.get(c.id);
      const cfSim = tItem && cItem ? Math.max(0, cosineSimilarity(tItem, cItem)) : 0.3;
      const hybridSim = 0.55 * contentSim + 0.45 * cfSim;
      return {
        ...c,
        matchScore: Math.round(Math.max(74, Math.min(99, 68 + hybridSim * 31))),
        matchReason: `SIMILAR TO ${target.title}`,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

export async function getSimilarMovies(
  store: DataStore,
  movieId: number,
  userId = 1,
  limit = 6
): Promise<RecommendedMovie[]> {
  const [allMovies, allRatings, userRatings, watchlistIds, watchHistory] =
    await Promise.all([
      store.getMovies(),
      store.getAllRatings(),
      store.getUserRatings(userId),
      store.getWatchlist(userId),
      store.getWatchHistory(userId),
    ]);

  const target = allMovies.find((m) => m.id === movieId);
  if (!target) return [];

  const featureVectors = new Map<number, Map<string, number>>();
  for (const m of allMovies) featureVectors.set(m.id, buildFeatureVector(m));
  const itemVectors = buildItemRatingVectors(allRatings);
  const { avgMap } = computeCommunityStats(allMovies, allRatings);
  const userRatingMap = new Map(userRatings.map((r) => [r.movieId, r.rating]));
  const watchlistSet = new Set(watchlistIds);
  const historyMap = new Map(watchHistory.map((h) => [h.movieId, h]));

  const candidates: RecommendedMovie[] = allMovies.map((m) => {
    const stats = avgMap.get(m.id) ?? { avg: 4.0, count: 0 };
    const hist = historyMap.get(m.id);
    return {
      ...m,
      matchScore: 80,
      matchReason: `SIMILAR TO ${target.title}`,
      userRating: userRatingMap.get(m.id),
      inMyList: watchlistSet.has(m.id),
      progressPercent: hist?.progressPercent,
      lastSeason: hist?.lastSeason,
      lastEpisode: hist?.lastEpisode,
      communityRating: stats.avg,
      ratingCount: stats.count,
    };
  });

  return getSimilarFromScored(target, candidates, featureVectors, itemVectors, limit);
}
