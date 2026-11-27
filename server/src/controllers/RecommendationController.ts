import { Request, Response } from 'express';
import { MoodTag, NavCategory } from '../domain/types';
import { IRecommendationService } from '../services/interfaces/ServiceInterfaces';
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
    const userId = this.parsePositiveInt(req.query.userId, 1);
    const mood = (String(req.query.mood ?? 'all') as MoodTag) || 'all';
    const category =
      (String(req.query.category ?? 'home') as NavCategory) || 'home';
    const feed = await this.recommender.generateFeed(userId, mood, category);
    res.json(feed);
  }
}
