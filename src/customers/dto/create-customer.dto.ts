import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimAndLowerCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateCustomerDto {
  @Transform(trim)
  @IsString({ message: 'name deve ser um texto' })
  @IsNotEmpty({ message: 'name é obrigatório' })
  @MaxLength(120, { message: 'name deve ter no máximo 120 caracteres' })
  name: string;

  @Transform(trimAndLowerCase)
  @IsEmail({}, { message: 'email deve ser um endereço de e-mail válido' })
  @MaxLength(254, { message: 'email deve ter no máximo 254 caracteres' })
  email: string;

  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'phone deve ser um texto' })
  @MaxLength(20, { message: 'phone deve ter no máximo 20 caracteres' })
  phone?: string;
}
