import dotenv from 'dotenv';
import path from 'path';
import { IAppConfig } from './IConfig';

/**
 * Singleton configuration loader implementing segregated config interfaces.
 */
export class AppConfig implements IAppConfig {
  private static instance: AppConfig | null = null;

  public readonly port: number;
  public readonly databaseUrl: string;
  public readonly tmdbApiKey: string;
  public readonly tmdbAccessToken: string;
  public readonly jwtSecret: string;
  public readonly jwtExpiresIn: string;

  private constructor() {
    const envPath = path.resolve(__dirname, '..', '..', '.env');
    dotenv.config({ path: envPath });

    this.port = Number(process.env.PORT) || 5050;
    this.databaseUrl =
      process.env.DATABASE_URL ||
      'postgresql://spacex:spacex_secret@localhost:5433/spacex_vod';
    this.tmdbApiKey = (process.env.TMDB_API_KEY || '').trim();
    this.tmdbAccessToken = (process.env.TMDB_ACCESS_TOKEN || '').trim();
    this.jwtSecret =
      (process.env.JWT_SECRET || '').trim() ||
      'spacex_vod_dev_jwt_secret_change_me';
    this.jwtExpiresIn = (process.env.JWT_EXPIRES_IN || '').trim() || '7d';
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
