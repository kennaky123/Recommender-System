export type MediaType = 'movie' | 'tv';
export type ProviderName =
  | 'NETFLIX'
  | 'HBOmax'
  | 'Disney+'
  | 'sky cinema'
  | 'sky one';
export type MoodTag =
  | 'all'
  | 'dramatic'
  | 'intense'
  | 'fun'
  | 'calm'
  | 'mind-bending'
  | 'epic';
export type NavCategory = 'home' | 'films' | 'shows' | 'live' | 'audio';

export interface Episode {
  season: number;
  episode: number;
  title: string;
  runtimeMinutes: number;
  synopsis: string;
  backdropUrl: string;
}

export interface Movie {
  id: number;
  movielensId?: number | null;
  tmdbId: number;
  imdbId?: string | null;
  mediaType: MediaType;
  title: string;
  provider: ProviderName;
  year: number;
  runtimeMinutes: number;
  ageRating: string;
  resolution: '8K' | '4K' | 'HD';
  genres: string[];
  tags: string[];
  moods: MoodTag[];
  synopsis: string;
  backdropUrl: string;
  trailerYoutubeId?: string | null;
  seasonsCount?: number;
  episodes?: Episode[];
}

export interface UserProfile {
  id: number;
  name: string;
  avatarUrl: string;
}

export interface RatingRecord {
  userId: number;
  movieId: number;
  rating: number;
  ratedAt: string;
}

export interface WatchProgressRecord {
  userId: number;
  movieId: number;
  progressSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  lastSeason: number;
  lastEpisode: number;
  updatedAt: string;
}

export interface RecommendedMovie extends Movie {
  matchScore: number;
  matchReason: string;
  userRating?: number;
  inMyList: boolean;
  progressPercent?: number;
  lastSeason?: number;
  lastEpisode?: number;
  communityRating: number;
  ratingCount: number;
}

export interface RecommendationFeed {
  heroFeatured: RecommendedMovie;
  newForYou: RecommendedMovie[];
  popularSuggestions: RecommendedMovie[];
  becauseYouWatched: {
    anchorTitle: string;
    items: RecommendedMovie[];
  } | null;
  continueWatching: RecommendedMovie[];
  myList: RecommendedMovie[];
  storageMode: 'postgres' | 'memory-fallback';
  engineStats: {
    totalMovies: number;
    totalRatings: number;
    userRatingsCount: number;
    weights: {
      contentBased: number;
      collaborative: number;
      popularityPrior: number;
    };
  };
}
