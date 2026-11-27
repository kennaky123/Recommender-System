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
export type CatalogSort = 'popular' | 'newest' | 'title';

export interface Episode {
  season: number;
  episode: number;
  title: string;
  runtimeMinutes: number;
  synopsis: string;
  backdropUrl: string;
}

export interface MovieDTO {
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

export interface RecommendedMovieDTO extends MovieDTO {
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

export interface RecommendationFeedDTO {
  heroFeatured: RecommendedMovieDTO;
  newForYou: RecommendedMovieDTO[];
  popularSuggestions: RecommendedMovieDTO[];
  becauseYouWatched: {
    anchorTitle: string;
    items: RecommendedMovieDTO[];
  } | null;
  continueWatching: RecommendedMovieDTO[];
  myList: RecommendedMovieDTO[];
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

export interface SearchPaginatedParams {
  userId?: number;
  query?: string;
  mood?: MoodTag;
  genre?: string;
  mediaType?: 'all' | 'movie' | 'tv';
  sort?: CatalogSort;
  page?: number;
  limit?: number;
}

export interface PaginatedCatalogResult {
  items: RecommendedMovieDTO[];
  total: number;
  page: number;
  totalPages: number;
  tmdbEnabled?: boolean;
  source?: string;
}
