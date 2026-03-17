import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AppUserDocument } from '../users/schemas/app-user.schema';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionAuthGuard } from './session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() request: Request & { user: AppUserDocument }) {
    return this.authService.toSessionPayload(request.user);
  }

  @UseGuards(SessionAuthGuard)
  @Post('logout')
  logout(@Req() request: Request & { user: AppUserDocument }) {
    return this.authService.logout(request.user);
  }
}
