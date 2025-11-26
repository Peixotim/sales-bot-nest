import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BlockContactDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  name?: string;
}
