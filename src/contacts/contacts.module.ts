import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IgnoredContact } from './entity/ignored-contact.entity';
import { ContactController } from './contacts.controller';
import { ContactService } from './contacts.service';

@Module({
  controllers: [ContactController],
  providers: [ContactService],
  imports: [TypeOrmModule.forFeature([IgnoredContact])],
  exports: [ContactService],
})
export class ContactsModule {}
