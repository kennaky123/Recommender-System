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
import { isTmdbConfigured } from './tmdbService';

const WEIGHTS = {
  contentBased: 0.45,
  collaborative: 0.45,
  popularityPrior: 0.1,
};

interface CachedEngineIndex {
  builtAt: number;
  movies: Movie[];
  movieById: Map<number, Movie>;
  featureVectors: Map<number, Map<string, number>>;
  itemVectors: Map<number, Map<number, number>>;
  avgMap: Map<number, { avg: number; count: number; bayesian: number }>;
  topPopularIds: number[];
  totalRatings: number;
}

let cachedIndex: CachedEngineIndex | null = null;

export function invalidateRecommendationCache(): void {
  cachedIndex = null;
}

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

  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [key, valA] of smaller.entries()) {
    const valB = larger.get(key);
    if (valB !== undefined) {
      dot += valA * valB;
    }
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEngineIndex(store: DataStore): Promise<CachedEngineIndex> {
  if (cachedIndex && Date.now() - cachedIndex.builtAt < 5 * 60 * 1000) {
    return cachedIndex;
  }

  const [movies, allRatings] = await Promise.all([
    store.getMovies(),
    store.getAllRatings(),
  ]);

  const movieById = new Map<number, Movie>();
  const featureVectors = new Map<number, Map<string, number>>();
  for (const m of movies) {
    movieById.set(m.id, m);
    featureVectors.set(m.id, buildFeatureVector(m));
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
  const avgMap = new Map<number, { avg: number; count: number; bayesian: number }>();

  for (const m of movies) {
    const entry = grouped.get(m.id);
    const v = entry?.count ?? 0;
    const R = v > 0 ? entry!.sum / v : globalMean;
    const bayesian = (v / (v + mPrior)) * R + (mPrior / (v + mPrior)) * globalMean;
    avgMap.set(m.id, {
      avg: Number(R.toFixed(2)),
      count: v,
      bayesian,
    });
  }

  const topPopularIds = [...movies]
    .sort((a, b) => {
      const sa = avgMap.get(a.id)!;
      const sb = avgMap.get(b.id)!;
      const scoreA = sa.bayesian + (sa.count >= 15 ? 0.35 : 0);
      const scoreB = sb.bayesian + (sb.count >= 15 ? 0.35 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 260)
    .map((m) => m.id);

  cachedIndex = {
    builtAt: Date.now(),
    movies,
    movieById,
    featureVectors,
    itemVectors,
    avgMap,
    topPopularIds,
    totalRatings: allRatings.length,
  };
  return cachedIndex;
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
  const [index, userRatings, watchlistIds, watchHistory] = await Promise.all([
    getEngineIndex(store),
    store.getUserRatings(userId),
    store.getWatchlist(userId),
    store.getWatchHistory(userId),
  ]);

  const userRatingMap = new Map<number, number>(
    userRatings.map((r) => [r.movieId, r.rating])
  );
  const watchlistSet = new Set<number>(watchlistIds);
  const historyMap = new Map<number, WatchProgressRecord>(
    watchHistory.map((h) => [h.movieId, h])
  );

  // Build User Content Profile Vector
  const userProfileVec = new Map<string, number>();
  const addWeightedFeatures = (movieId: number, weight: number) => {
    const fVec = index.featureVectors.get(movieId);
    if (!fVec) return;
    for (const [feat, val] of fVec.entries()) {
      userProfileVec.set(feat, (userProfileVec.get(feat) ?? 0) + val * weight);
    }
  };

  for (const r of userRatings) {
    addWeightedFeatures(r.movieId, r.rating - 2.5);
  }
  for (const mId of watchlistIds) {
    addWeightedFeatures(mId, 1.5);
  }
  for (const h of watchHistory) {
    addWeightedFeatures(h.movieId, h.progressPercent >= 50 ? 2.0 : 1.0);
  }

  const topRatedAnchorId =
    [...userRatings].sort((a, b) => b.rating - a.rating)[0]?.movieId ??
    watchHistory[0]?.movieId ??
    11;
  const anchorMovie =
    index.movieById.get(topRatedAnchorId) ?? index.movies[0];

  const likedSeedItems: Array<{ movieId: number; weight: number }> = [];
  for (const r of userRatings) {
    if (r.rating >= 3.5) {
      likedSeedItems.push({ movieId: r.movieId, weight: r.rating - 2.5 });
    }
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

  // Candidate pre-selection so scoring stays <50ms even with 9,700+ MovieLens titles
  const candidateIds = new Set<number>();
  for (const m of index.movies) {
    if (m.id <= 16 || m.mediaType === 'tv') candidateIds.add(m.id);
    if (mood !== 'all' && m.moods.includes(mood) && candidateIds.size < 360) {
      candidateIds.add(m.id);
    }
  }
  for (const id of index.topPopularIds) candidateIds.add(id);
  for (const id of watchlistIds) candidateIds.add(id);
  for (const h of watchHistory) candidateIds.add(h.movieId);
  for (const r of userRatings) candidateIds.add(r.movieId);

  // Also sample recent/high-rated Sci-Fi & Action MovieLens hits
  for (const m of index.movies) {
    if (candidateIds.size >= 450) break;
    const st = index.avgMap.get(m.id);
    if (st && st.count >= 20 && st.avg >= 3.9) {
      candidateIds.add(m.id);
    }
  }

  const candidateMovies = Array.from(candidateIds)
    .map((id) => index.movieById.get(id))
    .filter((m): m is Movie => Boolean(m));

  const scoreMovie = (movie: Movie): RecommendedMovie => {
    const mFeatures =
      index.featureVectors.get(movie.id) ?? buildFeatureVector(movie);
    const rawContentSim = cosineSimilarity(userProfileVec, mFeatures);
    const contentScore = Math.max(0, Math.min(1, (rawContentSim + 0.15) / 1.0));

    let cfWeightedSum = 0;
    let cfSimSum = 0;
    const targetItemVec = index.itemVectors.get(movie.id);
    if (targetItemVec && likedSeedItems.length > 0) {
      for (const seed of likedSeedItems) {
        if (seed.movieId === movie.id) continue;
        const seedVec = index.itemVectors.get(seed.movieId);
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

    const stats = index.avgMap.get(movie.id) ?? {
      avg: 4.0,
      count: 0,
      bayesian: 4.0,
    };
    const popScore = Math.max(0, Math.min(1, (stats.bayesian - 1) / 4));

    let hybrid =
      WEIGHTS.contentBased * contentScore +
      WEIGHTS.collaborative * cfScore +
      WEIGHTS.popularityPrior * popScore;

    const moodMatched = mood !== 'all' && movie.moods.includes(mood);
    if (moodMatched) {
      hybrid = Math.min(1, hybrid + 0.14);
    }

    const matchScore = Math.round(Math.max(72, Math.min(99, 68 + hybrid * 31)));

    let matchReason = 'POPULAR WITH SPACE-X VOYAGERS';
    if (moodMatched) {
      matchReason = `MATCHES ${mood.toUpperCase()} MOOD & ${
        movie.genres[0] ?? 'SCI-FI'
      }`;
    } else if (
      anchorMovie &&
      anchorMovie.id !== movie.id &&
      cfScore >= contentScore &&
      cfScore > 0.58
    ) {
      matchReason = `SIMILAR VIEWERS TO ${anchorMovie.title} LOVED THIS`;
    } else if (anchorMovie && anchorMovie.id !== movie.id && contentScore > 0.52) {
      const sharedGenre =
        movie.genres.find((g) => anchorMovie.genres.includes(g)) ??
        movie.genres[0];
      matchReason = `BECAUSE YOU LIKED ${anchorMovie.title} (${
        sharedGenre || 'SCI-FI'
      })`;
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
  };

  const scoredPool = candidateMovies.map(scoreMovie);

  const filteredMovies = filterByCategory(
    mood === 'all' ? scoredPool : scoredPool.filter((m) => m.moods.includes(mood)),
    category
  ) as RecommendedMovie[];

  const poolMovies =
    filteredMovies.length > 0
      ? filteredMovies
      : (filterByCategory(scoredPool, category) as RecommendedMovie[]);

  const showcasePriority = new Map<number, number>([
    [1, 1],
    [2, 2],
    [6, 3],
    [3, 4],
    [7, 5],
  ]);

  const newForYou = [...poolMovies]
    .sort((a, b) => {
      const scoreA =
        a.matchScore +
        (a.year >= 2020 ? 3 : 0) +
        (a.id <= 16 ? 5 : 0) +
        (showcasePriority.has(a.id) ? 4 : 0);
      const scoreB =
        b.matchScore +
        (b.year >= 2020 ? 3 : 0) +
        (b.id <= 16 ? 5 : 0) +
        (showcasePriority.has(b.id) ? 4 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (showcasePriority.get(a.id) ?? 99) - (showcasePriority.get(b.id) ?? 99);
    })
    .slice(0, 8);

  const popularSuggestions = [...poolMovies]
    .sort((a, b) => {
      const popA =
        a.communityRating * 10 +
        a.matchScore * 0.4 +
        (a.ratingCount >= 20 ? 6 : 0) +
        (a.id <= 16 ? 5 : 0);
      const popB =
        b.communityRating * 10 +
        b.matchScore * 0.4 +
        (b.ratingCount >= 20 ? 6 : 0) +
        (b.id <= 16 ? 5 : 0);
      return popB - popA;
    })
    .slice(0, 8);

  const becauseItems = anchorMovie
    ? getSimilarFromPool(anchorMovie, poolMovies, index, 8)
    : newForYou.slice(0, 8);

  const continueWatching = watchHistory
    .map((h) => index.movieById.get(h.movieId))
    .filter((m): m is Movie => Boolean(m))
    .map(scoreMovie);

  const myList = watchlistIds
    .map((id) => index.movieById.get(id))
    .filter((m): m is Movie => Boolean(m))
    .map(scoreMovie);

  const heroFeatured =
    category === 'home' && mood === 'all' && userRatings.length <= 2
      ? newForYou.find((m) => m.id === 1) ?? newForYou[0]
      : newForYou[0] ?? popularSuggestions[0];

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
    tmdbEnabled: isTmdbConfigured(),
    engineStats: {
      totalMovies: index.movies.length,
      totalRatings: index.totalRatings,
      userRatingsCount: userRatings.length,
      weights: WEIGHTS,
    },
  };
}

function getSimilarFromPool(
  target: Movie,
  candidates: RecommendedMovie[],
  index: CachedEngineIndex,
  limit: number
): RecommendedMovie[] {
  const tFeat = index.featureVectors.get(target.id) ?? buildFeatureVector(target);
  const tItem = index.itemVectors.get(target.id);

  return candidates
    .filter((c) => c.id !== target.id)
    .map((c) => {
      const cFeat = index.featureVectors.get(c.id) ?? buildFeatureVector(c);
      const contentSim = cosineSimilarity(tFeat, cFeat);
      const cItem = index.itemVectors.get(c.id);
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
  const [index, userRatings, watchlistIds, watchHistory] = await Promise.all([
    getEngineIndex(store),
    store.getUserRatings(userId),
    store.getWatchlist(userId),
    store.getWatchHistory(userId),
  ]);

  const target = index.movieById.get(movieId);
  if (!target) return [];

  const userRatingMap = new Map(userRatings.map((r) => [r.movieId, r.rating]));
  const watchlistSet = new Set(watchlistIds);
  const historyMap = new Map(watchHistory.map((h) => [h.movieId, h]));

  // Candidate subset sharing at least 1 genre or popular
  const candidates: RecommendedMovie[] = [];
  for (const m of index.movies) {
    if (m.id === movieId) continue;
    const sharesGenre = m.genres.some((g) => target.genres.includes(g));
    if (!sharesGenre && m.id > 16 && candidates.length > 250) continue;
    const stats = index.avgMap.get(m.id) ?? { avg: 4.0, count: 0 };
    const hist = historyMap.get(m.id);
    candidates.push({
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
    });
    if (candidates.length >= 300) break;
  }

  return getSimilarFromPool(target, candidates, index, limit);
}
