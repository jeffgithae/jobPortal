import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { AppUserDocument } from '../users/schemas/app-user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly sessionTtlMs = 1000 * 60 * 60 * 24 * 30;

  constructor(private readonly usersService: UsersService) {}

  async register(registerDto: RegisterDto) {
    const passwordSalt = this.createSalt();
    const passwordHash = this.hashPassword(registerDto.password, passwordSalt);
    const user = await this.usersService.createUserAccount({
      displayName: registerDto.displayName,
      email: registerDto.email,
      passwordSalt,
      passwordHash,
    });

    return this.issueSession(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user?.passwordSalt || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const candidateHash = this.hashPassword(loginDto.password, user.passwordSalt);
    const candidateBuffer = Buffer.from(candidateHash, 'hex');
    const actualBuffer = Buffer.from(user.passwordHash, 'hex');

    if (candidateBuffer.length !== actualBuffer.length || !timingSafeEqual(candidateBuffer, actualBuffer)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.issueSession(user);
  }

  async getUserFromSessionToken(token: string) {
    const user = await this.usersService.findBySessionTokenHash(this.hashToken(token));

    if (!user) {
      throw new UnauthorizedException('Your session is no longer valid.');
    }

    return user;
  }

  async logout(user: AppUserDocument) {
    await this.usersService.clearSession(user.id);
    return { success: true };
  }

  toSessionPayload(user: AppUserDocument, session?: { token: string; expiresAt: string }) {
    return {
      user: {
        ownerKey: user.ownerKey,
        displayName: user.displayName,
        email: user.email,
      },
      session,
    };
  }

  private async issueSession(user: AppUserDocument) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);
    const persistedUser = await this.usersService.saveSession(user.id, this.hashToken(token), expiresAt);

    if (!persistedUser) {
      throw new UnauthorizedException('Unable to start a session.');
    }

    return this.toSessionPayload(persistedUser, {
      token,
      expiresAt: expiresAt.toISOString(),
    });
  }

  private createSalt() {
    return randomBytes(16).toString('hex');
  }

  private hashPassword(password: string, salt: string) {
    return scryptSync(password, salt, 64).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
