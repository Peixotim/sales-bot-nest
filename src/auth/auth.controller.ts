import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConsultantService } from 'src/consultant/consultant.service';
import { RegisterConsultantDTO } from 'src/consultant/DTOs/consultant-register.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './DTOs/login.dto';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from 'src/interfaces/request-with-user.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly consultantService: ConsultantService,
    private readonly authService: AuthService,
  ) {}

  @Post('register-consultant')
  public async registerConsultant(@Body() request: RegisterConsultantDTO) {
    return await this.consultantService.register(request);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Req() req: RequestWithUser) {
    return req.user;
  }
}
