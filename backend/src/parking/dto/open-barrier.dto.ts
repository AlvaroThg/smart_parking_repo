import { IsString, IsNotEmpty, Length } from 'class-validator';

export class OpenBarrierDto {
  @IsString()
  @IsNotEmpty({ message: 'El token no puede estar vacío' })
  @Length(36, 36, { message: 'El token debe ser un UUID de 36 caracteres' })
  token: string;
}
