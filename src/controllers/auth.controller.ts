import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import type { LoginDTO } from '../dtos/auth.dto';
import type { CreateUserDTO } from '../dtos/user.dto';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

@Controller('auth')
export class AuthController {
  public constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(UserService) private readonly userService: UserService,
  ) {}

  @Post('login')
  @HttpCode(200)
  public login(@Body() credentials: LoginDTO) {
    return this.authService.login(credentials);
  }

  @Post('register')
  public async register(@Body() input: CreateUserDTO) {
    return { user: await this.userService.register(input) };
  }
}
