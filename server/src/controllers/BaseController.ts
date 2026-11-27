import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { RequestValidationError } from '../validation/RequestValidationError';
import { formatZodIssues } from '../validation/schemas';

/**
 * Abstract base controller providing encapsulated Express router setup,
 * centralized Zod validation, and unified HTTP error handling.
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
        if (err instanceof RequestValidationError) {
          res.status(err.statusCode).json({
            error: err.message,
            issues: err.issues,
          });
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ error: message });
      });
    };
  }

  protected validate<Output, Def extends z.ZodTypeDef = z.ZodTypeDef, Input = Output>(
    schema: z.ZodType<Output, Def, Input>,
    input: unknown
  ): Output {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const issues = formatZodIssues(parsed.error);
      throw new RequestValidationError(
        issues[0]?.message ?? 'Invalid request payload',
        issues
      );
    }
    return parsed.data;
  }
}
