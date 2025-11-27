import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConsultantEntity } from './entity/consultant.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterConsultantDTO } from './DTOs/consultant-register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ConsultantService {
  constructor(
    @InjectRepository(ConsultantEntity)
    private readonly consultantRepository: Repository<ConsultantEntity>,
  ) {}

  public async register(request: RegisterConsultantDTO) {
    const emailExists = await this.consultantRepository.findOneBy({
      email: request.email,
    });
    if (emailExists) {
      throw new ConflictException('Erro: Já existe uma conta com este email.');
    }

    const numberExists = await this.consultantRepository.findOneBy({
      number: request.number,
    });
    if (numberExists) {
      throw new ConflictException('Erro: Já existe uma conta com este número.');
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(request.password, salt);

    const newConsultant = this.consultantRepository.create({
      name: request.name,
      email: request.email,
      number: request.number,
      password: hashedPassword,
    });

    const savedUser = await this.consultantRepository.save(newConsultant);
    return savedUser;
  }

  public async findByEmailForLogin(
    email: string,
  ): Promise<ConsultantEntity | null> {
    const user = await this.consultantRepository.findOne({
      where: { email },
      relations: ['enterprise'],
    });

    if (!user) {
      throw new NotFoundException('Erro: Usuario não foi encontrado !');
    }

    return user;
  }

  public async findByNumber(number: string): Promise<ConsultantEntity | null> {
    return this.consultantRepository.findOneBy({ number });
  }
}
