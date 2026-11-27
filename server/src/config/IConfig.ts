/**
 * Interface Segregation Principle (ISP):
 * Narrow configuration contracts so components only see the settings they need.
 */
export interface IServerConfig {
  readonly port: number;
}

export interface IDatabaseConfig {
  readonly databaseUrl: string;
}

export interface ITmdbConfig {
  readonly tmdbApiKey: string;
  readonly tmdbAccessToken: string;
  isTmdbConfigured(): boolean;
}

export interface IAuthConfig {
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
}

export type InterleavingPlacement =
  | 'home_hero'
  | 'home_for_you'
  | 'home_because_watched'
  | 'home_hidden_gems'
  | 'detail_similar'
  | 'discover_critique';

export interface IInternalAuthConfig {
  readonly internalApiToken: string;
}

export interface IInterleavingConfig {
  readonly interleavingEnabled: boolean;
  readonly interleavingPlacement: InterleavingPlacement;
  readonly interleavingAlgoA: string;
  readonly interleavingAlgoB: string;
}

export interface IAppConfig
  extends IServerConfig,
    IDatabaseConfig,
    ITmdbConfig,
    IAuthConfig,
    IInternalAuthConfig,
    IInterleavingConfig {}
