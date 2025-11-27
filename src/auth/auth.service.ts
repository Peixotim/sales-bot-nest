import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConsultantService } from 'src/consultant/consultant.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './DTOs/login.dto';
import { JwtPayload } from 'src/interfaces/JwtPayload';
@Injectable()
export class AuthService {
  constructor(
    private consultantService: ConsultantService,
    private jwtService: JwtService,
  ) {}

  public async validateUser(email: string, pass: string) {
    const user = await this.consultantService.findByEmailForLogin(email);

    const passwordCompare = await bcrypt.compare(pass, user!.password);

    if (!user) {
      throw new NotFoundException(
        'Erro : Não foi possivel achar uma conta com este email , verifique porfavor suas credenciais e tente logar novamente !',
      );
    }

    if (passwordCompare === false) {
      throw new BadRequestException('Erro : Credenciais incorretas !');
    }

    if (user && passwordCompare) {
      return user;
    }

    return null;
  }

  public async login(login: LoginDto) {
    const user = await this.validateUser(login.email, login.password);

    if (!user) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    const payload: JwtPayload = {
      email: user.email,
      sub: user.number,
      name: user.name,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        name: user.name,
        email: user.email,
        number: user.number,
      },
    };
  }
}
