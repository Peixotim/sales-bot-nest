import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from 'src/interfaces/request-with-user.interface';
import { WhatsappStatus } from './enums/whatsapp-status.types';

@Controller('whatsapp')
@UseGuards(AuthGuard('jwt'))
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Get('status')
  public getStatus(@Request() req: RequestWithUser) {
    const sessionId = req.user.userId;

    if (!sessionId) throw new UnauthorizedException('Sessão inválida');

    return this.whatsAppService.getStatus(sessionId);
  }

  @Get('qr')
  public async getQrCode(@Request() req: RequestWithUser) {
    const sessionId = req.user.userId;
    if (!sessionId) throw new UnauthorizedException('Sessão inválida');

    const status = this.whatsAppService.getStatus(sessionId);

    if (status.status === WhatsappStatus.DISCONNECTED) {
      await this.whatsAppService.connectToWhatsapp(sessionId);
      return {
        status: 'INITIALIZING',
        message: 'Iniciando bot, tente novamente em 3 segundos...',
      };
    }

    return this.whatsAppService.getQrCode(sessionId);
  }

  @Get('chats')
  public async getActiveChats() {
    return this.whatsAppService.getActiveChats();
  }

  @Get('history/:jid')
  public async getChatHistory(@Param('jid') jid: string) {
    const realJid = jid.includes('@s.whatsapp.net')
      ? jid
      : `${jid}@s.whatsapp.net`;

    return this.whatsAppService.getChatHistory(realJid);
  }
}
