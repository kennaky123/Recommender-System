import cors from 'cors';
import express, { Express } from 'express';
import { AppConfig } from '../config/AppConfig';
import { IAppConfig } from '../config/IConfig';
import { BaseController } from '../controllers/BaseController';
import { AuthController } from '../controllers/AuthController';
import { HealthController } from '../controllers/HealthController';
import { MovieController } from '../controllers/MovieController';
import { RecommendationController } from '../controllers/RecommendationController';
import { UserController } from '../controllers/UserController';
import { DatabaseConnection } from '../repositories/DatabaseConnection';
import { DatabaseSeeder } from '../repositories/DatabaseSeeder';
import { DrizzleMediaRepository } from '../repositories/DrizzleMediaRepository';
import { IMediaRepository } from '../repositories/IMediaRepository';
import { InMemoryMediaRepository } from '../repositories/InMemoryMediaRepository';
import { AuthService } from '../services/auth/AuthService';
import { JwtTokenProvider } from '../services/auth/JwtTokenProvider';
import { ScryptPasswordHasher } from '../services/auth/ScryptPasswordHasher';
import { CatalogService } from '../services/CatalogService';
import { CollaborativeStrategy } from '../services/recommendation/CollaborativeStrategy';
import { ContentBasedStrategy } from '../services/recommendation/ContentBasedStrategy';
import { HybridRecommendationService } from '../services/recommendation/HybridRecommendationService';
import { MatchReasonExplainer } from '../services/recommendation/MatchReasonExplainer';
import { MoodBoostStrategy } from '../services/recommendation/MoodBoostStrategy';
import { PopularityPriorStrategy } from '../services/recommendation/PopularityPriorStrategy';
import { RecommendationFeedAssembler } from '../services/recommendation/RecommendationFeedAssembler';
import { RecommendationIndexStore } from '../services/recommendation/RecommendationIndexStore';
import { TmdbApiClient } from '../services/TmdbApiClient';
import { UserActivityService } from '../services/UserActivityService';

/**
 * Sole Composition Root wiring concrete implementations into interface-bound services and controllers.
 */
export class ServerApplication {
  private readonly config: IAppConfig;
  private readonly app: Express;

  public constructor(config: IAppConfig = AppConfig.getInstance()) {
    this.config = config;
    this.app = express();
    this.configureMiddleware();
  }

  private configureMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private async initializeRepository(): Promise<IMediaRepository> {
    const db = DatabaseConnection.getInstance(this.config);
    const seeder = new DatabaseSeeder(db);
    try {
      await db.testConnection();
      await seeder.applySchema();
      await seeder.seedDefaultsIfEmpty();
      console.log('[DB] Connected to PostgreSQL via DrizzleMediaRepository (Drizzle ORM).');
      return new DrizzleMediaRepository(db);
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
    const externalProvider = new TmdbApiClient(this.config);

    const indexStore = new RecommendationIndexStore(repository, repository);
    const explainer = new MatchReasonExplainer();
    const assembler = new RecommendationFeedAssembler();

    const recommender = new HybridRecommendationService({
      storageStatus: repository,
      ratingRepo: repository,
      watchlistRepo: repository,
      watchHistoryRepo: repository,
      userProfileRepo: repository,
      externalProvider,
      indexStore,
      explainer,
      assembler,
      strategies: [
        new ContentBasedStrategy(0.45),
        new CollaborativeStrategy(0.45),
        new PopularityPriorStrategy(0.1),
        new MoodBoostStrategy(0.14),
      ],
    });

    const catalogService = new CatalogService({
      catalogRepo: repository,
      storageStatus: repository,
      externalProvider,
      recommender,
      cacheInvalidator: recommender,
    });

    const userService = new UserActivityService({
      storageStatus: repository,
      catalogRepo: repository,
      ratingRepo: repository,
      watchlistRepo: repository,
      watchHistoryRepo: repository,
      userProfileRepo: repository,
      recommender,
      cacheInvalidator: recommender,
    });

    const authService = new AuthService({
      userRepo: repository,
      passwordHasher: new ScryptPasswordHasher(),
      tokenProvider: new JwtTokenProvider(this.config),
    });

    this.mountControllers([
      new HealthController(catalogService),
      new AuthController(authService),
      new MovieController(catalogService),
      new RecommendationController(recommender),
      new UserController(userService),
    ]);

    this.app.listen(this.config.port, () => {
      console.log(
        `[SPACE-X VOD API - OOP+SOLID] Listening on http://localhost:${this.config.port} (storage: ${repository.getStorageMode()}, tmdb: ${externalProvider.isConfigured()})`
      );
    });
  }
}
