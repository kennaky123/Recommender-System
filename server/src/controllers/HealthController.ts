import { Request, Response } from 'express';
import { ICatalogService } from '../services/interfaces/ServiceInterfaces';
import { BaseController } from './BaseController';

/**
 * Health & telemetry controller depending strictly on ICatalogService abstraction (DIP).
 */
export class HealthController extends BaseController {
  private readonly catalogService: ICatalogService;

  public constructor(catalogService: ICatalogService) {
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
      architecture: 'OOP+SOLID',
      ...snapshot,
    });
  }
}
