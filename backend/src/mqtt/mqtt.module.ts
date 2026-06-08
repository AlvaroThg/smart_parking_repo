import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';

/**
 * @Global() permite que MqttService se inyecte en cualquier módulo
 * sin necesidad de re-importar MqttModule.
 */
@Global()
@Module({
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
