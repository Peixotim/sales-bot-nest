import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsAppSession } from './entity/whatsapp-session.entity';
import { WhatsAppAuthService } from './providers/whatsapp-auth.service';
import { AiService } from 'src/ai/ai.service';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsAppSession])],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppAuthService, AiService],
})
export class WhatsAppModule {}
