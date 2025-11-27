import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultantEntity } from './entity/consultant.entity';
import { ConsultantService } from './consultant.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConsultantEntity])],
  providers: [ConsultantService],
  exports: [ConsultantService],
})
export class ConsultantModule {}
