import jwt, { SignOptions } from 'jsonwebtoken';
import { IAuthConfig } from '../../config/IConfig';
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
    const decoded = jwt.verify(token, this.config.jwtSecret) as AuthTokenPayload;
    if (!decoded || !decoded.userId) {
      throw new Error('Invalid token payload');
    }
    return {
      userId: Number(decoded.userId),
      email: String(decoded.email),
      name: String(decoded.name),
    };
  }
}
