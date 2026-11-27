import { Request, Response } from 'express';
import { CatalogService } from '../services/CatalogService';
import { BaseController } from './BaseController';

/**
 * Health & telemetry controller reporting PostgreSQL/TMDB readiness and OOP status.
 */
export class HealthController extends BaseController {
  private readonly catalogService: CatalogService;

  public constructor(catalogService: CatalogService) {
    super();
    this.catalogService = catalogService;
  }

  protected registerRoutes(): void {
    this.router.get('/health', this.handleAsync(this.getHealth.bind(this)));
  }

  private async getHealth(_req: Request, res: Response): Promise<void> {
    const snapshot = await this.catalogService.getHealthSnapshot();
    res.json({
      status: 'ok',
      architecture: 'OOP',
      ...snapshot,
    });
  }
}
