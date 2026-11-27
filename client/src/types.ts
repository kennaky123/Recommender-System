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
export type NavCategory =
  | 'search'
  | 'discover'
  | 'home'
  | 'films'
  | 'shows'
  | 'my-list'
  | 'live'
  | 'audio'
  | 'settings';
export type CatalogSort = 'popular' | 'newest' | 'title';

export type PlaybackDevice =
  | 'CABIN DISPLAY 8K'
  | 'CREW TABLET'
  | 'SPACE-X VR HEADSET';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Episode {
  season: number;
  episode: number;
  title: string;
  runtimeMinutes: number;
  synopsis: string;
  backdropUrl: string;
}

export interface RecommendedMovie {
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
  source?: 'local' | 'movielens' | 'tmdb';
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
  tmdbEnabled: boolean;
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

export interface PaginatedCatalogResponse {
  items: RecommendedMovie[];
  total: number;
  page: number;
  totalPages: number;
  tmdbEnabled: boolean;
  source: string;
}

export interface SearchCatalogResponse {
  movies: RecommendedMovie[];
  total: number;
  page: number;
  totalPages: number;
  tmdbEnabled: boolean;
  sourcesUsed: string[];
}

export interface UserProfileResponse {
  profile: {
    id: number;
    name: string;
    email?: string | null;
    avatarUrl: string;
  };
  storageMode: 'postgres' | 'memory-fallback';
  ratings: Array<{
    userId: number;
    movieId: number;
    rating: number;
    ratedAt: string;
    movieTitle: string;
  }>;
  watchlistCount: number;
  watchHistoryCount: number;
}
