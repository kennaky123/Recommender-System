import dotenv from 'dotenv';
import path from 'path';
import { envSchema } from '../validation/schemas';
import { IAppConfig } from './IConfig';

/**
 * Singleton configuration loader validating runtime env with Zod.
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

    const env = envSchema.parse(process.env);
    this.port = env.PORT;
    this.databaseUrl = env.DATABASE_URL;
    this.tmdbApiKey = env.TMDB_API_KEY;
    this.tmdbAccessToken = env.TMDB_ACCESS_TOKEN;
    this.jwtSecret = env.JWT_SECRET;
    this.jwtExpiresIn = env.JWT_EXPIRES_IN;
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
