import { NextFunction, Request, Response, Router } from 'express';

/**
 * Abstract base controller providing encapsulated Express router setup and async error handling.
 */
export abstract class BaseController {
  protected readonly router: Router;

  protected constructor() {
    this.router = Router();
  }

  protected abstract registerRoutes(): void;

  public getRouter(): Router {
    this.registerRoutes();
    return this.router;
  }

  protected handleAsync(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
  ) {
    return (req: Request, res: Response, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ error: message });
      });
    };
  }

  protected parsePositiveInt(
    value: unknown,
    fallback: number
  ): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }
}
