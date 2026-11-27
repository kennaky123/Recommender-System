import jwt, { SignOptions } from 'jsonwebtoken';
import { IAuthConfig } from '../../config/IConfig';
import { normalizeUserRole } from '../../domain/types';
import {
  AuthTokenPayload,
  ITokenProvider,
} from '../interfaces/ServiceInterfaces';

/**
 * Single Responsibility: issues and verifies JWT bearer tokens using IAuthConfig (DIP + ISP).
 */
export class JwtTokenProvider implements ITokenProvider {
  private readonly config: IAuthConfig;

  public constructor(config: IAuthConfig) {
    this.config = config;
  }

  public sign(payload: AuthTokenPayload): string {
    const options: SignOptions = {
      expiresIn: this.config.jwtExpiresIn as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, this.config.jwtSecret, options);
  }

  public verify(token: string): AuthTokenPayload {
    const decoded = jwt.verify(token, this.config.jwtSecret);
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Invalid token payload');
    }
    const record = decoded as Record<string, unknown>;
    const userId = Number(record.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('Invalid token payload');
    }
    return {
      userId,
      email: String(record.email ?? ''),
      name: String(record.name ?? ''),
      role: normalizeUserRole(record.role),
    };
  }
}
