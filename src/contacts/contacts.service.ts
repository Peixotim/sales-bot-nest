import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IgnoredContact } from './entity/ignored-contact.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(IgnoredContact)
    private readonly ignoredContactsRepository: Repository<IgnoredContact>,
  ) {}

  public async findAllBlocks(): Promise<IgnoredContact[]> {
    const findAll = await this.ignoredContactsRepository.find({
      order: { createdAt: 'DESC' },
    });

    if (findAll.length === 0) {
      throw new NotFoundException('Não há nenhum contato bloqueado.');
    }

    return findAll;
  }

  public async findOneBlock(phoneNumber: string) {
    const jid = this.formatJid(phoneNumber);

    const blocked = await this.ignoredContactsRepository.findOneBy({ jid });

    if (!blocked) {
      throw new NotFoundException(
        'Erro: este contato não está na lista de bloqueio.',
      );
    }

    return blocked;
  }

  public async isContactBlocked(jid: string): Promise<boolean> {
    const count = await this.ignoredContactsRepository.count({
      where: { jid },
    });
    return count > 0;
  }

  public async blockContact(phone: string, name: string = 'Desconhecido') {
    const jid = this.formatJid(phone);

    const existing = await this.ignoredContactsRepository.findOneBy({ jid });

    if (existing) {
      throw new ConflictException('Este contato já está bloqueado.');
    }

    await this.ignoredContactsRepository.save({ jid, name });

    this.logger.warn(`🚫 Contato bloqueado: ${name} (${jid})`);
    return { message: 'Contato bloqueado com sucesso!' };
  }

  public async unblockContact(phone: string) {
    const jid = this.formatJid(phone);

    const result = await this.ignoredContactsRepository.delete({ jid });

    if (result.affected === 0) {
      throw new NotFoundException('Contato não encontrado para desbloqueio.');
    }

    this.logger.log(`✅ Contato desbloqueado: ${jid}`);

    return { message: 'Contato desbloqueado com sucesso.' };
  }

  private formatJid(phone: string): string {
    let cleanNumber = phone.replace('@s.whatsapp.net', '');
    cleanNumber = cleanNumber.replace(/\D/g, '');
    return `${cleanNumber}@s.whatsapp.net`;
  }
}
