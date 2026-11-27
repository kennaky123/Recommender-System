import { Request, Response } from 'express';
import { CatalogSort, MoodTag, MovieDTO } from '../domain/types';
import { ICatalogService } from '../services/interfaces/ServiceInterfaces';
import { BaseController } from './BaseController';

/**
 * Controller exposing catalog pagination, search, movie details, and similarity via ICatalogService (DIP).
 */
export class MovieController extends BaseController {
  private readonly catalogService: ICatalogService;

  public constructor(catalogService: ICatalogService) {
    super();
    this.catalogService = catalogService;
  }

  protected registerRoutes(): void {
    this.router.get('/movies', this.handleAsync(this.listMovies.bind(this)));
    this.router.get('/catalog', this.handleAsync(this.getCatalog.bind(this)));
    this.router.get('/search', this.handleAsync(this.searchMovies.bind(this)));
    this.router.post(
      '/movies/ensure',
      this.handleAsync(this.ensureMovie.bind(this))
    );
    this.router.get('/movies/:id', this.handleAsync(this.getById.bind(this)));
    this.router.get(
      '/movies/:id/similar',
      this.handleAsync(this.getSimilar.bind(this))
    );
  }

  private async listMovies(req: Request, res: Response): Promise<void> {
    const page = this.parsePositiveInt(req.query.page, 1);
    const limit = this.parsePositiveInt(req.query.limit, 24);
    const result = await this.catalogService.getCatalog({
      userId: 1,
      category: 'all',
      mediaType: 'all',
      genre: 'ALL',
      mood: 'all',
      sort: 'popular',
      page,
      limit,
      source: 'auto',
    });
    res.json({ movies: result.items, ...result });
  }

  private async getCatalog(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveInt(req.query.userId, 1);
    const category = String(req.query.category ?? 'all');
    const mediaType =
      (String(req.query.mediaType ?? 'all') as 'all' | 'movie' | 'tv') || 'all';
    const genre = req.query.genre ? String(req.query.genre) : 'ALL';
    const mood = (String(req.query.mood ?? 'all') as MoodTag) || 'all';
    const sort = (String(req.query.sort ?? 'popular') as CatalogSort) || 'popular';
    const page = this.parsePositiveInt(req.query.page, 1);
    const limit = this.parsePositiveInt(req.query.limit, 24);
    const source = String(req.query.source ?? 'auto');

    const result = await this.catalogService.getCatalog({
      userId,
      category,
      mediaType,
      genre,
      mood,
      sort,
      page,
      limit,
      source,
    });
    res.json(result);
  }

  private async searchMovies(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveInt(req.query.userId, 1);
    const query = String(req.query.q ?? '');
    const mood = (String(req.query.mood ?? 'all') as MoodTag) || 'all';
    const genre = req.query.genre ? String(req.query.genre) : 'ALL';
    const mediaType =
      (String(req.query.mediaType ?? 'all') as 'all' | 'movie' | 'tv') || 'all';
    const page = this.parsePositiveInt(req.query.page, 1);
    const limit = this.parsePositiveInt(req.query.limit, 24);

    const result = await this.catalogService.search({
      userId,
      query,
      mood,
      genre,
      mediaType,
      page,
      limit,
    });
    res.json(result);
  }

  private async ensureMovie(req: Request, res: Response): Promise<void> {
    const payload = req.body as Partial<MovieDTO>;
    if (!payload.tmdbId || !payload.title) {
      res.status(400).json({ error: 'tmdbId and title are required' });
      return;
    }
    const movie = await this.catalogService.ensureExternalMedia(payload);
    res.json({ movie });
  }

  private async getById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Invalid movie id' });
      return;
    }
    const movie = await this.catalogService.getMediaDetails(id);
    if (!movie) {
      res.status(404).json({ error: 'Movie not found' });
      return;
    }
    res.json({ movie });
  }

  private async getSimilar(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Invalid movie id' });
      return;
    }
    const userId = this.parsePositiveInt(req.query.userId, 1);
    const limit = this.parsePositiveInt(req.query.limit, 6);
    const items = await this.catalogService.getSimilar(id, userId, limit);
    res.json({ items });
  }
}
