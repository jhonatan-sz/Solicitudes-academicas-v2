import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

/**
 * Smoke test de arranque.
 *
 * Verifica que la aplicación completa (módulos, guards, filtros, Prisma) se
 * instancia y responde. Requiere las variables de entorno del .env y una base
 * de datos accesible: PrismaService conecta en onModuleInit.
 *
 * No sustituye a un E2E de negocio; es la red mínima para detectar que el
 * ensamblado de la app está roto antes de desplegar.
 */
describe('App (e2e smoke)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde ok', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 'ok',
          service: 'solicitudes-academicas-api',
        });
      });
  });

  it('protege los endpoints privados sin token', () => {
    return request(app.getHttpServer()).get('/api/requests').expect(401);
  });
});
