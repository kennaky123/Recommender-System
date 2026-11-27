import { Request, Response } from 'express';
import { UserActivityService } from '../services/UserActivityService';
import { BaseController } from './BaseController';

/**
 * Controller handling user profiles, watchlist toggling, star ratings, and playback progress sync.
 */
export class UserController extends BaseController {
  private readonly userService: UserActivityService;

  public constructor(userService: UserActivityService) {
    super();
    this.userService = userService;
  }

  protected registerRoutes(): void {
    this.router.get(
      '/user/:userId/profile',
      this.handleAsync(this.getProfile.bind(this))
    );
    this.router.get(
      '/user/:userId/watchlist',
      this.handleAsync(this.getWatchlist.bind(this))
    );
    this.router.post(
      '/user/:userId/watchlist/:movieId',
      this.handleAsync(this.toggleWatchlist.bind(this))
    );
    this.router.post(
      '/user/:userId/ratings',
      this.handleAsync(this.submitRating.bind(this))
    );
    this.router.post(
      '/user/:userId/watch-progress',
      this.handleAsync(this.saveWatchProgress.bind(this))
    );
  }

  private async getProfile(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveInt(req.params.userId, 1);
    const summary = await this.userService.getProfileSummary(userId);
    res.json(summary);
  }

  private async getWatchlist(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveInt(req.params.userId, 1);
    const movieIds = await this.userService.getWatchlist(userId);
    res.json({ movieIds });
  }

  private async toggleWatchlist(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveInt(req.params.userId, 1);
    const movieId = Number(req.params.movieId);
    if (!Number.isFinite(movieId)) {
      res.status(400).json({ error: 'Invalid movieId' });
      return;
    }
    const result = await this.userService.toggleWatchlist(userId, movieId);
    res.json(result);
  }

  private async submitRating(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveInt(req.params.userId, 1);
    const { movieId, rating } = req.body as {
      movieId?: number;
      rating?: number;
    };
    if (!movieId || !rating || rating < 0.5 || rating > 5) {
      res
        .status(400)
        .json({ error: 'movieId and rating (0.5..5.0) are required' });
      return;
    }
    const result = await this.userService.rateMedia(
      userId,
      Number(movieId),
      Number(rating)
    );
    res.json(result);
  }

  private async saveWatchProgress(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveInt(req.params.userId, 1);
    const { movieId, progressSeconds, durationSeconds, season, episode } =
      req.body as {
        movieId?: number;
        progressSeconds?: number;
        durationSeconds?: number;
        season?: number;
        episode?: number;
      };
    if (!movieId || progressSeconds === undefined || !durationSeconds) {
      res.status(400).json({
        error: 'movieId, progressSeconds, and durationSeconds are required',
      });
      return;
    }
    const result = await this.userService.recordWatchProgress(
      userId,
      Number(movieId),
      Number(progressSeconds),
      Number(durationSeconds),
      season ? Number(season) : 1,
      episode ? Number(episode) : 1
    );
    res.json(result);
  }
}
