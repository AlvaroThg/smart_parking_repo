import { IsUUID, IsIn, IsNotEmpty } from 'class-validator';

export class ReserveSpotDto {
  @IsUUID('4', { message: 'parkingId debe ser un UUID v4 válido' })
  @IsNotEmpty()
  parkingId: string;

  @IsIn(['A', 'B'], { message: 'spot debe ser "A" o "B"' })
  @IsNotEmpty()
  spot: 'A' | 'B';
}
