import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
export class RegisterConsultantDTO {
  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'A senha deve ter no minimo 6 caracteres' })
  @MaxLength(120)
  password: string;
}
