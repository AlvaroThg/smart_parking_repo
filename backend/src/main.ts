import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para el cliente móvil
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Pipe global de validación con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // Elimina campos no declarados en el DTO
      forbidNonWhitelisted: true,
      transform: true,         // Transforma payloads al tipo del DTO
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Smart Parking API corriendo en: http://0.0.0.0:${port}`);
}

bootstrap();
