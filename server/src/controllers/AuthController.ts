import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthError } from '../services/auth/AuthService';
import { IAuthService } from '../services/interfaces/ServiceInterfaces';
import { BaseController } from './BaseController';

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be under 60 characters'),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[0-9]/, 'Password must include a number'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Auth controller validating payloads with Zod and delegating to IAuthService (DIP).
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
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid registration data',
      });
      return;
    }
    try {
      const result = await this.authService.register(parsed.data);
      res.status(201).json(result);
    } catch (err) {
      if (!this.handleAuthError(err, res)) throw err;
    }
  }

  private async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid login credentials',
      });
      return;
    }
    try {
      const result = await this.authService.login(parsed.data);
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
