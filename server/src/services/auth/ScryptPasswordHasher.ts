import crypto from 'crypto';
import { IPasswordHasher } from '../interfaces/ServiceInterfaces';

/**
 * Single Responsibility: scrypt password hashing + constant-time verification.
 */
export class ScryptPasswordHasher implements IPasswordHasher {
  private static readonly KEY_LENGTH = 64;

  public hash(plainPassword: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto
      .scryptSync(plainPassword, salt, ScryptPasswordHasher.KEY_LENGTH)
      .toString('hex');
    return `${salt}:${derived}`;
  }

  public verify(plainPassword: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, keyHex] = parts;
    if (!salt || !keyHex) return false;

    const expected = Buffer.from(keyHex, 'hex');
    const actual = crypto.scryptSync(
      plainPassword,
      salt,
      ScryptPasswordHasher.KEY_LENGTH
    );
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  }
}
