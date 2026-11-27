import { Request, Response } from 'express';
import { ICatalogService } from '../services/interfaces/ServiceInterfaces';
import {
  catalogQuerySchema,
  ensureMovieBodySchema,
  listMoviesQuerySchema,
  movieIdParamSchema,
  searchQuerySchema,
  similarMoviesQuerySchema,
} from '../validation/schemas';
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
    const { page, limit } = this.validate(listMoviesQuerySchema, req.query);
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
    const query = this.validate(catalogQuerySchema, req.query);
    const result = await this.catalogService.getCatalog(query);
    res.json(result);
  }

  private async searchMovies(req: Request, res: Response): Promise<void> {
    const { userId, q, mood, genre, mediaType, page, limit } = this.validate(
      searchQuerySchema,
      req.query
    );
    const result = await this.catalogService.search({
      userId,
      query: q,
      mood,
      genre,
      mediaType,
      page,
      limit,
    });
    res.json(result);
  }

  private async ensureMovie(req: Request, res: Response): Promise<void> {
    const payload = this.validate(ensureMovieBodySchema, req.body);
    const movie = await this.catalogService.ensureExternalMedia(payload);
    res.json({ movie });
  }

  private async getById(req: Request, res: Response): Promise<void> {
    const { id } = this.validate(movieIdParamSchema, req.params);
    const movie = await this.catalogService.getMediaDetails(id);
    if (!movie) {
      res.status(404).json({ error: 'Movie not found' });
      return;
    }
    res.json({ movie });
  }

  private async getSimilar(req: Request, res: Response): Promise<void> {
    const { id } = this.validate(movieIdParamSchema, req.params);
    const { userId, limit } = this.validate(
      similarMoviesQuerySchema,
      req.query
    );
    const items = await this.catalogService.getSimilar(id, userId, limit);
    res.json({ items });
  }
}
