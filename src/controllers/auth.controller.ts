import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import type { LoginDTO } from '../dtos/auth.dto';
import { AuthService } from '../services/auth.service';
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}
  @Post('login')
  @HttpCode(200)
  login(@Body() credentials: LoginDTO) {
    return this.authService.login(credentials);
  }
}
