import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from 'nestjs-pino';
import { WhatsAppModule } from 'src/whatsapp/whatsapp.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsAppSession } from 'src/whatsapp/entity/whatsapp-session.entity';
import { ConfigModule } from '@nestjs/config';
import { ChatHistory } from 'src/ai/entities/chat-history.entity';
import { ContactsModule } from 'src/contacts/contacts.module';
import { AuthModule } from 'src/auth/auth.module';
import { ConsultantModule } from 'src/consultant/consultant.module';
import { ConsultantEntity } from 'src/consultant/entity/consultant.entity';
import { EnterpriseEntity } from 'src/enterprise/entity/enterprise.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, //Permite usar o .env em qualquer lugar
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      autoLoadEntities: true,
      synchronize: true, // OBSERVAÇÃO PARA O FUTURO (DEIXE FALSE PARA PRODUÇÃO !!!)
      entities: [
        WhatsAppSession,
        ChatHistory,
        ConsultantEntity,
        EnterpriseEntity,
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                },
              }
            : undefined,
      },
    }),
    WhatsAppModule,
    ContactsModule,
    AuthModule,
    ConsultantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
