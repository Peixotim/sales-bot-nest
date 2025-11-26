import { Controller, Get, Param } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Get('status')
  public getStatus() {
    return this.whatsAppService.getStatus();
  }

  @Get('qr')
  public getQrCode() {
    return this.whatsAppService.getQrCode();
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
