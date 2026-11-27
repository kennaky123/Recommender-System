import { Request, Response } from 'express';
import { AuthError } from '../services/auth/AuthService';
import { IAuthService } from '../services/interfaces/ServiceInterfaces';
import { loginBodySchema, registerBodySchema } from '../validation/schemas';
import { BaseController } from './BaseController';

/**
 * Auth controller validating payloads with centralized Zod schemas and delegating to IAuthService (DIP).
 */
export class AuthController extends BaseController {
  private readonly authService: IAuthService;

  public constructor(authService: IAuthService) {
    super();
    this.authService = authService;
  }

  protected registerRoutes(): void {
    this.router.post(
      '/auth/register',
      this.handleAsync(this.register.bind(this))
    );
    this.router.post('/auth/login', this.handleAsync(this.login.bind(this)));
    this.router.get('/auth/me', this.handleAsync(this.getMe.bind(this)));
  }

  private handleAuthError(err: unknown, res: Response): boolean {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return true;
    }
    return false;
  }

  private async register(req: Request, res: Response): Promise<void> {
    const input = this.validate(registerBodySchema, req.body);
    try {
      const result = await this.authService.register(input);
      res.status(201).json(result);
    } catch (err) {
      if (!this.handleAuthError(err, res)) throw err;
    }
  }

  private async login(req: Request, res: Response): Promise<void> {
    const input = this.validate(loginBodySchema, req.body);
    try {
      const result = await this.authService.login(input);
      res.json(result);
    } catch (err) {
      if (!this.handleAuthError(err, res)) throw err;
    }
  }

  private async getMe(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization Bearer token' });
      return;
    }
    try {
      const user = await this.authService.getCurrentUser(token);
      res.json({ user });
    } catch (err) {
      if (!this.handleAuthError(err, res)) throw err;
    }
  }
}
