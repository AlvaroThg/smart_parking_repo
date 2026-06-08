import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { OpenBarrierDto } from './dto/open-barrier.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { v4 as uuidv4 } from 'uuid';

// Tópicos MQTT
const MQTT_TOPIC_CONTROL = 'smartparking/control_puerta';
const MQTT_TOPIC_SENSORES = 'smartparking/sensores';

@Injectable()
export class ParkingService implements OnModuleInit {
  private readonly logger = new Logger(ParkingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  onModuleInit() {
    this.logger.log(`📡 Registrando suscripción a sensores MQTT en [${MQTT_TOPIC_SENSORES}]...`);
    this.mqttService.subscribe(MQTT_TOPIC_SENSORES, async (message) => {
      try {
        const payload = JSON.parse(message);
        const { ocupado_a, ocupado_b } = payload;

        // Buscamos el primer estacionamiento (la maqueta física)
        const parking = await this.prisma.estacionamiento.findFirst({
          orderBy: { createdAt: 'asc' },
        });

        if (parking) {
          // Si el estado físico cambia, lo actualizamos en la base de datos
          if (parking.ocupado_a !== ocupado_a || parking.ocupado_b !== ocupado_b) {
            const dataToUpdate: any = { ocupado_a, ocupado_b };
            
            // Si un cajón pasa a estar físicamente ocupado, limpiamos cualquier reserva activa de ese cajón
            if (ocupado_a) {
              dataToUpdate.reservado_a = false;
              dataToUpdate.token_reserva_a = null;
            }
            if (ocupado_b) {
              dataToUpdate.reservado_b = false;
              dataToUpdate.token_reserva_b = null;
            }

            await this.prisma.estacionamiento.update({
              where: { id: parking.id },
              data: dataToUpdate,
            });
            this.logger.log(
              `🚗 Sensores maqueta actualizados -> Cajón A: ${ocupado_a ? 'OCUPADO' : 'LIBRE'} | Cajón B: ${ocupado_b ? 'OCUPADO' : 'LIBRE'}`,
            );
          }
        }
      } catch (err) {
        this.logger.error('❌ Error al procesar mensaje de sensores MQTT:', err.message);
      }
    });
  }

  /**
   * Devuelve la lista de todos los estacionamientos con su estado actual.
   */
  async findAll() {
    return this.prisma.estacionamiento.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Reserva un cajón (A o B) en un estacionamiento.
   * Reglas de negocio:
   *  - El cajón no debe estar ocupado físicamente.
   *  - El cajón no debe tener una reserva activa.
   * Si está libre, genera un token UUID y lo guarda en BD.
   */
  async reserve(dto: ReserveSpotDto) {
    const { parkingId, spot } = dto;

    // Busca el estacionamiento en BD
    const parking = await this.prisma.estacionamiento.findUnique({
      where: { id: parkingId },
    });

    if (!parking) {
      throw new NotFoundException(
        `Estacionamiento con ID "${parkingId}" no encontrado`,
      );
    }

    // Verifica estado del cajón solicitado
    const ocupado = spot === 'A' ? parking.ocupado_a : parking.ocupado_b;
    const reservado = spot === 'A' ? parking.reservado_a : parking.reservado_b;

    if (ocupado) {
      throw new ConflictException(
        `El cajón ${spot} está actualmente ocupado y no puede reservarse`,
      );
    }

    if (reservado) {
      throw new ConflictException(
        `El cajón ${spot} ya tiene una reserva activa`,
      );
    }

    // Genera token único de reserva
    const token = uuidv4();

    // Actualiza el estado en BD según el cajón
    const updateData =
      spot === 'A'
        ? { reservado_a: true, token_reserva_a: token }
        : { reservado_b: true, token_reserva_b: token };

    const updated = await this.prisma.estacionamiento.update({
      where: { id: parkingId },
      data: updateData,
    });

    this.logger.log(
      `✅ Reserva creada — Cajón ${spot} del estacionamiento "${updated.nombre}" | Token: ${token}`,
    );

    return {
      mensaje: `Cajón ${spot} reservado exitosamente`,
      token,
      estacionamiento: updated.nombre,
      cajon: spot,
    };
  }

  /**
   * Valida el token de reserva y publica el comando MQTT para abrir la barrera.
   * Después de abrir, limpia el token y marca el cajón como ocupado.
   */
  async openBarrier(dto: OpenBarrierDto) {
    const { token } = dto;

    // Busca qué estacionamiento y cajón tiene ese token
    const parking = await this.prisma.estacionamiento.findFirst({
      where: {
        OR: [
          { token_reserva_a: token },
          { token_reserva_b: token },
        ],
      },
    });

    if (!parking) {
      throw new NotFoundException(
        `Token de reserva inválido o ya utilizado: "${token}"`,
      );
    }

    // Determina cuál cajón pertenece al token
    const spot: 'A' | 'B' = parking.token_reserva_a === token ? 'A' : 'B';

    // Publica comando en MQTT para accionar el servo del ESP32
    this.mqttService.publish(MQTT_TOPIC_CONTROL, 'ABRIR');

    // Actualiza BD: marca cajón como ocupado y limpia la reserva
    const updateData =
      spot === 'A'
        ? { ocupado_a: true, reservado_a: false, token_reserva_a: null }
        : { ocupado_b: true, reservado_b: false, token_reserva_b: null };

    await this.prisma.estacionamiento.update({
      where: { id: parking.id },
      data: updateData,
    });

    this.logger.log(
      `🚗 Barrera abierta — Cajón ${spot} de "${parking.nombre}" | Tópico: ${MQTT_TOPIC_CONTROL}`,
    );

    return {
      mensaje: `Barrera abierta. Bienvenido al cajón ${spot} de "${parking.nombre}"`,
      cajon: spot,
      estacionamiento: parking.nombre,
    };
  }

  /**
   * Cancela una reserva activa usando el token.
   * Restablece el cajón a disponible (reservado = false, token = null).
   */
  async cancel(dto: CancelReservationDto) {
    const { token } = dto;

    // Busca qué estacionamiento y cajón tiene ese token
    const parking = await this.prisma.estacionamiento.findFirst({
      where: {
        OR: [
          { token_reserva_a: token },
          { token_reserva_b: token },
        ],
      },
    });

    if (!parking) {
      throw new NotFoundException(
        `Token de reserva inválido o no encontrado: "${token}"`,
      );
    }

    // Determina cuál cajón pertenece al token
    const spot: 'A' | 'B' = parking.token_reserva_a === token ? 'A' : 'B';

    // Actualiza BD: limpia la reserva
    const updateData =
      spot === 'A'
        ? { reservado_a: false, token_reserva_a: null }
        : { reservado_b: false, token_reserva_b: null };

    await this.prisma.estacionamiento.update({
      where: { id: parking.id },
      data: updateData,
    });

    this.logger.log(
      `❌ Reserva cancelada — Cajón ${spot} de "${parking.nombre}" | Token: ${token}`,
    );

    return {
      mensaje: `Reserva del cajón ${spot} cancelada exitosamente`,
      cajon: spot,
      estacionamiento: parking.nombre,
    };
  }
}
