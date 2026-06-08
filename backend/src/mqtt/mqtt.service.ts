import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('MQTT_HOST');
    const port = this.configService.get<number>('MQTT_PORT', 8883);
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    const brokerUrl = `mqtts://${host}:${port}`;

    this.logger.log(`🔌 Conectando a broker MQTT: ${brokerUrl}`);

    this.client = mqtt.connect(brokerUrl, {
      username,
      password,
      // HiveMQ Cloud requiere TLS — el protocolo mqtts:// lo maneja automáticamente
      rejectUnauthorized: true,
      reconnectPeriod: 5000, // Re-intenta cada 5 segundos si se cae la conexión
      connectTimeout: 30_000,
      clientId: `smart-parking-backend-${Math.random().toString(16).slice(2, 10)}`,
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Conectado al broker MQTT (HiveMQ Cloud)');
    });

    this.client.on('error', (err) => {
      this.logger.error('❌ Error en conexión MQTT:', err.message);
    });

    this.client.on('reconnect', () => {
      this.logger.warn('🔄 Reconectando al broker MQTT...');
    });

    this.client.on('offline', () => {
      this.logger.warn('📡 Cliente MQTT desconectado (offline)');
    });
  }

  /**
   * Publica un mensaje en un tópico MQTT.
   * @param topic  Tópico destino, ej: "smartparking/control_puerta"
   * @param message Payload del mensaje, ej: "ABRIR"
   * @param qos    Calidad de servicio (0, 1 o 2). Default: 1
   */
  publish(topic: string, message: string, qos: 0 | 1 | 2 = 1): void {
    if (!this.client?.connected) {
      this.logger.warn(`⚠️ No se puede publicar: cliente MQTT no conectado (tópico: ${topic})`);
      return;
    }

    this.client.publish(topic, message, { qos }, (err) => {
      if (err) {
        this.logger.error(`❌ Error publicando en ${topic}:`, err.message);
      } else {
        this.logger.log(`📤 Publicado en [${topic}]: "${message}"`);
      }
    });
  }

  /**
   * Suscribe al cliente a un tópico y registra un callback.
   * Útil para recibir datos de sensores del ESP32.
   */
  subscribe(topic: string, callback: (message: string) => void): void {
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(`❌ Error suscribiéndose a ${topic}:`, err.message);
        return;
      }
      this.logger.log(`📥 Suscrito a tópico: ${topic}`);
    });

    this.client.on('message', (receivedTopic, payload) => {
      if (receivedTopic === topic) {
        callback(payload.toString());
      }
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end();
      this.logger.log('🔌 Conexión MQTT cerrada');
    }
  }
}
