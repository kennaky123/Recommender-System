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

export interface IAppConfig
  extends IServerConfig,
    IDatabaseConfig,
    ITmdbConfig {}
