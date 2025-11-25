import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, //Habilita bufferLogs
  });

  app.useLogger(app.get(Logger)); //Habilita o pino

  await app.listen(process.env.PORT ?? 8080);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  //Configura Swagger
  const config = new DocumentBuilder()
    .setTitle('ChatBot API')
    .setDescription('Documentação da API do ChatBot')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
}
bootstrap();
