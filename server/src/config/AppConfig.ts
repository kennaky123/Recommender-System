import dotenv from 'dotenv';
import path from 'path';
import { envSchema } from '../validation/schemas';
import { IAppConfig, InterleavingPlacement } from './IConfig';

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
  public readonly internalApiToken: string;
  public readonly interleavingEnabled: boolean;
  public readonly interleavingPlacement: InterleavingPlacement;
  public readonly interleavingAlgoA: string;
  public readonly interleavingAlgoB: string;

  private constructor(rawEnv?: Record<string, string | undefined>) {
    if (rawEnv === undefined) {
      const envPath = path.resolve(__dirname, '..', '..', '.env');
      dotenv.config({ path: envPath });
    }

    const env = envSchema.parse(rawEnv ?? process.env);
    this.port = env.PORT;
    this.databaseUrl = env.DATABASE_URL;
    this.tmdbApiKey = env.TMDB_API_KEY;
    this.tmdbAccessToken = env.TMDB_ACCESS_TOKEN;
    this.jwtSecret = env.JWT_SECRET;
    this.jwtExpiresIn = env.JWT_EXPIRES_IN;
    this.internalApiToken = env.INTERNAL_API_TOKEN;
    this.interleavingEnabled = env.INTERLEAVING_ENABLED;
    this.interleavingPlacement = env.INTERLEAVING_PLACEMENT;
    this.interleavingAlgoA = env.INTERLEAVING_ALGO_A;
    this.interleavingAlgoB = env.INTERLEAVING_ALGO_B;
  }

  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  public static fromEnv(rawEnv: Record<string, string | undefined>): AppConfig {
    return new AppConfig(rawEnv);
  }

  public isTmdbConfigured(): boolean {
    return Boolean(this.tmdbApiKey || this.tmdbAccessToken);
  }
}
