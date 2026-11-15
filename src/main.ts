import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/* Vet frontend runs on 5174 so it can run next to the owner portal (5173). */
const DEV_CORS_ORIGINS = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const corsOrigins = corsOrigin
    ? corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
    : nodeEnv === 'production'
      ? []
      : DEV_CORS_ORIGINS;

  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGIN is required when NODE_ENV is production');
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('port') ?? 3001;
  await app.listen(port);
}
void bootstrap();
