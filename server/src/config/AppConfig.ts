import dotenv from 'dotenv';
import path from 'path';

/**
 * Singleton configuration loader for the Space-X VOD backend.
 */
export class AppConfig {
  private static instance: AppConfig | null = null;

  public readonly port: number;
  public readonly databaseUrl: string;
  public readonly tmdbApiKey: string;
  public readonly tmdbAccessToken: string;

  private constructor() {
    const envFromDistOrSrc = path.resolve(__dirname, '..', '..', '.env');
    dotenv.config({ path: envFromDistOrSrc });

    this.port = Number(process.env.PORT) || 5050;
    this.databaseUrl =
      process.env.DATABASE_URL ||
      'postgresql://spacex:spacex_secret@localhost:5433/spacex_vod';
    this.tmdbApiKey = (process.env.TMDB_API_KEY || '').trim();
    this.tmdbAccessToken = (process.env.TMDB_ACCESS_TOKEN || '').trim();
  }

  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  public isTmdbConfigured(): boolean {
    return Boolean(this.tmdbApiKey || this.tmdbAccessToken);
  }
}
