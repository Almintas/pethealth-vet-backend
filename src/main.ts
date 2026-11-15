import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/* Vet frontend runs on 5174 so it can run next to the owner portal (5173). */
const DEV_CORS_ORIGINS = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';

  // Behind Railway's proxy req.ip must come from X-Forwarded-For, otherwise
  // every client shares one rate-limit bucket. TRUST_PROXY overrides
  // (number of proxy hops, or "false").
  app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY, nodeEnv));
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const corsOrigins = corsOrigin
    ? corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
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
function resolveTrustProxy(
  value: string | undefined,
  nodeEnv: string,
): number | boolean {
  const raw = value?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') {
    return false;
  }
  if (raw === 'true') {
    return true;
  }
  const hops = Number(raw);
  if (raw && Number.isInteger(hops) && hops > 0) {
    return hops;
  }
  return nodeEnv === 'production' ? 1 : false;
}

void bootstrap();
