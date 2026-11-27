import cors from 'cors';
import express, { Express } from 'express';
import { AppConfig } from '../config/AppConfig';
import { BaseController } from '../controllers/BaseController';
import { HealthController } from '../controllers/HealthController';
import { MovieController } from '../controllers/MovieController';
import { RecommendationController } from '../controllers/RecommendationController';
import { UserController } from '../controllers/UserController';
import { DatabaseConnection } from '../repositories/DatabaseConnection';
import { IMediaRepository } from '../repositories/IMediaRepository';
import { InMemoryMediaRepository } from '../repositories/InMemoryMediaRepository';
import { PostgresMediaRepository } from '../repositories/PostgresMediaRepository';
import { CatalogService } from '../services/CatalogService';
import { CollaborativeStrategy } from '../services/recommendation/CollaborativeStrategy';
import { ContentBasedStrategy } from '../services/recommendation/ContentBasedStrategy';
import { HybridRecommendationService } from '../services/recommendation/HybridRecommendationService';
import { PopularityPriorStrategy } from '../services/recommendation/PopularityPriorStrategy';
import { TmdbApiClient } from '../services/TmdbApiClient';
import { UserActivityService } from '../services/UserActivityService';

/**
 * Composition Root assembling Repositories, Services, Strategies, and Controllers via Constructor DI.
 */
export class ServerApplication {
  private readonly config: AppConfig;
  private readonly app: Express;

  public constructor(config: AppConfig = AppConfig.getInstance()) {
    this.config = config;
    this.app = express();
    this.configureMiddleware();
  }

  private configureMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private async initializeRepository(): Promise<IMediaRepository> {
    const db = DatabaseConnection.getInstance();
    try {
      await db.testConnection();
      await db.applySchema();
      await db.seedDefaultsIfEmpty();
      console.log('[DB] Connected to PostgreSQL via PostgresMediaRepository.');
      return new PostgresMediaRepository(db);
    } catch (err) {
      console.warn(
        `[DB] PostgreSQL unavailable (${(err as Error).message}). Using InMemoryMediaRepository.`
      );
      return new InMemoryMediaRepository();
    }
  }

  private mountControllers(controllers: BaseController[]): void {
    for (const controller of controllers) {
      this.app.use('/api', controller.getRouter());
    }
  }

  public async start(): Promise<void> {
    const repository = await this.initializeRepository();
    const tmdbClient = new TmdbApiClient(this.config);

    const recommender = new HybridRecommendationService(repository, tmdbClient, [
      new ContentBasedStrategy(0.45),
      new CollaborativeStrategy(0.45),
      new PopularityPriorStrategy(0.1),
    ]);

    const catalogService = new CatalogService(
      repository,
      tmdbClient,
      recommender
    );
    const userService = new UserActivityService(repository, recommender);

    this.mountControllers([
      new HealthController(catalogService),
      new MovieController(catalogService),
      new RecommendationController(recommender),
      new UserController(userService),
    ]);

    this.app.listen(this.config.port, () => {
      console.log(
        `[SPACE-X VOD API - OOP] Listening on http://localhost:${this.config.port} (storage: ${repository.getStorageMode()}, tmdb: ${tmdbClient.isConfigured()})`
      );
    });
  }
}
