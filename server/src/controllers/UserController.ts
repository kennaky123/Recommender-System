import { Request, Response } from 'express';
import { IAuthMiddleware } from '../middleware/JwtAuthMiddleware';
import { IUserActivityService } from '../services/interfaces/ServiceInterfaces';
import {
  submitRatingBodySchema,
  userIdParamSchema,
  watchlistToggleParamsSchema,
  watchProgressBodySchema,
} from '../validation/schemas';
import { BaseController } from './BaseController';

/**
 * Controller handling user profiles, watchlist, ratings, and playback progress via IUserActivityService (DIP).
 */
export class UserController extends BaseController {
  private readonly userService: IUserActivityService;
  private readonly authMiddleware: IAuthMiddleware;

  public constructor(
    userService: IUserActivityService,
    authMiddleware: IAuthMiddleware
  ) {
    super();
    this.userService = userService;
    this.authMiddleware = authMiddleware;
  }

  protected registerRoutes(): void {
    const guard = this.authMiddleware.requireSelfOrResearcher();

    this.router.get(
      '/user/:userId/profile',
      guard,
      this.handleAsync(this.getProfile.bind(this))
    );
    this.router.get(
      '/user/:userId/watchlist',
      guard,
      this.handleAsync(this.getWatchlist.bind(this))
    );
    this.router.post(
      '/user/:userId/watchlist/:movieId',
      guard,
      this.handleAsync(this.toggleWatchlist.bind(this))
    );
    this.router.post(
      '/user/:userId/ratings',
      guard,
      this.handleAsync(this.submitRating.bind(this))
    );
    this.router.post(
      '/user/:userId/watch-progress',
      guard,
      this.handleAsync(this.saveWatchProgress.bind(this))
    );
  }

  private async getProfile(req: Request, res: Response): Promise<void> {
    const { userId } = this.validate(userIdParamSchema, req.params);
    const summary = await this.userService.getProfileSummary(userId);
    res.json(summary);
  }

  private async getWatchlist(req: Request, res: Response): Promise<void> {
    const { userId } = this.validate(userIdParamSchema, req.params);
    const movieIds = await this.userService.getWatchlist(userId);
    res.json({ movieIds });
  }

  private async toggleWatchlist(req: Request, res: Response): Promise<void> {
    const { userId, movieId } = this.validate(
      watchlistToggleParamsSchema,
      req.params
    );
    const result = await this.userService.toggleWatchlist(userId, movieId);
    res.json(result);
  }

  private async submitRating(req: Request, res: Response): Promise<void> {
    const { userId } = this.validate(userIdParamSchema, req.params);
    const { movieId, rating } = this.validate(submitRatingBodySchema, req.body);
    const result = await this.userService.rateMedia(userId, movieId, rating);
    res.json(result);
  }

  private async saveWatchProgress(req: Request, res: Response): Promise<void> {
    const { userId } = this.validate(userIdParamSchema, req.params);
    const { movieId, progressSeconds, durationSeconds, season, episode } =
      this.validate(watchProgressBodySchema, req.body);
    const result = await this.userService.recordWatchProgress(
      userId,
      movieId,
      progressSeconds,
      durationSeconds,
      season,
      episode
    );
    res.json(result);
  }
}
