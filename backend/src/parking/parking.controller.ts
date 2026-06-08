import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ParkingService } from './parking.service';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { OpenBarrierDto } from './dto/open-barrier.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';

@Controller('parking')
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  /**
   * GET /parking
   * Retorna todos los estacionamientos y su estado en tiempo real.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.parkingService.findAll();
  }

  /**
   * POST /parking/reserve
   * Body: { parkingId: string (UUID), spot: 'A' | 'B' }
   * Verifica disponibilidad del cajón y crea una reserva con token único.
   */
  @Post('reserve')
  @HttpCode(HttpStatus.CREATED)
  reserve(@Body() dto: ReserveSpotDto) {
    return this.parkingService.reserve(dto);
  }

  /**
   * POST /parking/open
   * Body: { token: string }
   * Valida el token y publica "ABRIR" en el tópico MQTT del ESP32.
   */
  @Post('open')
  @HttpCode(HttpStatus.OK)
  openBarrier(@Body() dto: OpenBarrierDto) {
    return this.parkingService.openBarrier(dto);
  }

  /**
   * POST /parking/cancel
   * Body: { token: string }
   * Cancela la reserva activa y vuelve a poner el cajón como disponible.
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancelReservation(@Body() dto: CancelReservationDto) {
    return this.parkingService.cancel(dto);
  }
}
