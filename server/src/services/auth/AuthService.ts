import {
  AuthResponseDTO,
  AuthUserRecord,
  PublicUserDTO,
} from '../../domain/types';
import { IAuthUserRepository } from '../../repositories/interfaces/RepositoryInterfaces';
import {
  IAuthService,
  IPasswordHasher,
  ITokenProvider,
} from '../interfaces/ServiceInterfaces';

export class AuthError extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface AuthServiceDeps {
  userRepo: IAuthUserRepository;
  passwordHasher: IPasswordHasher;
  tokenProvider: ITokenProvider;
}

/**
 * Auth application service depending strictly on segregated repository & crypto interfaces (ISP + DIP).
 */
export class AuthService implements IAuthService {
  private readonly deps: AuthServiceDeps;

  public constructor(deps: AuthServiceDeps) {
    this.deps = deps;
  }

  private toPublicUser(user: AuthUserRecord): PublicUserDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      onboardingCompleted: user.onboardingCompleted,
      preferredGenres: [...user.preferredGenres],
      preferredMoods: [...user.preferredMoods],
    };
  }

  public async register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthResponseDTO> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.deps.userRepo.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new AuthError('Email is already registered.', 409);
    }

    const passwordHash = this.deps.passwordHasher.hash(input.password);
    const created = await this.deps.userRepo.createAuthUser({
      name: input.name.trim().toUpperCase(),
      email: normalizedEmail,
      passwordHash,
      avatarUrl: '/backdrops/claude-patterson.jpg',
    });

    const user = this.toPublicUser(created);
    const token = this.deps.tokenProvider.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return { token, user };
  }

  public async login(input: {
    email: string;
    password: string;
  }): Promise<AuthResponseDTO> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const found = await this.deps.userRepo.findUserByEmail(normalizedEmail);
    if (!found || !found.passwordHash) {
      throw new AuthError('Invalid email or password.', 401);
    }

    const valid = this.deps.passwordHasher.verify(
      input.password,
      found.passwordHash
    );
    if (!valid) {
      throw new AuthError('Invalid email or password.', 401);
    }

    const user = this.toPublicUser(found);
    const token = this.deps.tokenProvider.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return { token, user };
  }

  public async getCurrentUser(token: string): Promise<PublicUserDTO> {
    try {
      const payload = this.deps.tokenProvider.verify(token);
      const found = await this.deps.userRepo.findUserById(payload.userId);
      if (!found) {
        throw new AuthError('Account not found.', 401);
      }
      return this.toPublicUser(found);
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Session expired or invalid token.', 401);
    }
  }
}
