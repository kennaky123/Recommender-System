import bcrypt from 'bcryptjs';
import { IPasswordHasher } from '../interfaces/ServiceInterfaces';
import { ScryptPasswordHasher } from './ScryptPasswordHasher';

/**
 * Single Responsibility: bcrypt password hashing + verification
 * (with transparent legacy scrypt verification fallback for existing DB rows).
 */
export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly saltRounds: number;
  private readonly legacyVerifier = new ScryptPasswordHasher();

  public constructor(saltRounds = 10) {
    this.saltRounds = saltRounds;
  }

  public hash(plainPassword: string): string {
    return bcrypt.hashSync(plainPassword, this.saltRounds);
  }

  public verify(plainPassword: string, storedHash: string): boolean {
    if (!storedHash) return false;
    if (storedHash.startsWith('$2')) {
      return bcrypt.compareSync(plainPassword, storedHash);
    }
    return this.legacyVerifier.verify(plainPassword, storedHash);
  }
}
