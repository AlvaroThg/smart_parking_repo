import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { ParkingModule } from './parking/parking.module';

@Module({
  imports: [
    // Carga variables de entorno del archivo .env globalmente
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Módulo global de Prisma (conexión a PostgreSQL/Supabase)
    PrismaModule,

    // Módulo MQTT (conexión a HiveMQ Cloud)
    MqttModule,

    // Módulo principal de negocio
    ParkingModule,
  ],
})
export class AppModule {}
