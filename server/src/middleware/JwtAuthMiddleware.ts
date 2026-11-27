import crypto from 'node:crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { UserRole } from '../domain/types';
import {
  AuthTokenPayload,
  ITokenProvider,
} from '../services/interfaces/ServiceInterfaces';

export interface AuthenticatedRequest extends Request {
  authUser?: AuthTokenPayload;
}

export interface IAuthMiddleware {
  optionalAuth(): RequestHandler;
  requireAuth(): RequestHandler;
  requireSelfOrResearcher(paramName?: string): RequestHandler;
  requireInternalToken(): RequestHandler;
}

/**
 * Express JWT & internal-token authorization middleware (DIP via IAuthMiddleware).
 */
export class JwtAuthMiddleware implements IAuthMiddleware {
  private readonly tokenProvider: ITokenProvider;
  private readonly internalApiToken: string;

  public constructor(tokenProvider: ITokenProvider, internalApiToken: string) {
    this.tokenProvider = tokenProvider;
    this.internalApiToken = internalApiToken;
  }

  private extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (typeof header !== 'string') return null;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) return null;
    const token = match[1].trim();
    return token.length > 0 ? token : null;
  }

  private matchesInternalToken(provided: string | string[] | undefined): boolean {
    if (typeof provided !== 'string') return false;
    if (!provided || !this.internalApiToken.trim()) return false;
    const providedBuf = Buffer.from(provided, 'utf8');
    const expectedBuf = Buffer.from(this.internalApiToken, 'utf8');
    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }

  private isPrivilegedRole(role: UserRole): boolean {
    return role === 'admin' || role === 'researcher';
  }

  private parsePositiveIntParam(raw: unknown): number | null {
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private authenticateBearer(req: Request): AuthTokenPayload | null {
    const token = this.extractBearerToken(req);
    if (!token) return null;
    try {
      return this.tokenProvider.verify(token);
    } catch {
      return null;
    }
  }

  public optionalAuth(): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const payload = this.authenticateBearer(req);
      if (payload) {
        (req as AuthenticatedRequest).authUser = payload;
      }
      next();
    };
  }

  public requireAuth(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      const payload = this.authenticateBearer(req);
      if (!payload) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      (req as AuthenticatedRequest).authUser = payload;
      next();
    };
  }

  public requireSelfOrResearcher(paramName = 'userId'): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      const payload = this.authenticateBearer(req);
      if (!payload) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const targetUserId = this.parsePositiveIntParam(req.params[paramName]);
      if (targetUserId === null) {
        res.status(400).json({ error: `Invalid ${paramName} parameter.` });
        return;
      }

      if (payload.userId !== targetUserId && !this.isPrivilegedRole(payload.role)) {
        res.status(403).json({ error: 'Forbidden: insufficient permissions.' });
        return;
      }

      (req as AuthenticatedRequest).authUser = payload;
      next();
    };
  }

  public requireInternalToken(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (this.matchesInternalToken(req.headers['x-internal-token'])) {
        next();
        return;
      }

      const payload = this.authenticateBearer(req);
      if (!payload) {
        res.status(401).json({ error: 'Internal authorization required.' });
        return;
      }

      if (!this.isPrivilegedRole(payload.role)) {
        res.status(403).json({ error: 'Forbidden: researcher or admin role required.' });
        return;
      }

      (req as AuthenticatedRequest).authUser = payload;
      next();
    };
  }
}
