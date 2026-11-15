import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('health query returns ok', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: '{ health { status timestamp } }',
      })
      .expect(200);

    expect(response.body.data.health.status).toBe('ok');
    expect(response.body.data.health.timestamp).toBeDefined();
  });
});
