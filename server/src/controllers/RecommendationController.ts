import { Request, Response } from 'express';
import { IRecommendationService } from '../services/interfaces/ServiceInterfaces';
import { recommendationsQuerySchema } from '../validation/schemas';
import { BaseController } from './BaseController';

/**
 * Controller exposing personalized hybrid recommendation feeds via IRecommendationService (DIP).
 */
export class RecommendationController extends BaseController {
  private readonly recommender: IRecommendationService;

  public constructor(recommender: IRecommendationService) {
    super();
    this.recommender = recommender;
  }

  protected registerRoutes(): void {
    this.router.get(
      '/recommendations',
      this.handleAsync(this.getRecommendations.bind(this))
    );
  }

  private async getRecommendations(req: Request, res: Response): Promise<void> {
    const { userId, mood, category } = this.validate(
      recommendationsQuerySchema,
      req.query
    );
    const feed = await this.recommender.generateFeed(userId, mood, category);
    res.json(feed);
  }
}
