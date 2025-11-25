import { Controller, Get } from '@nestjs/common';
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
}
