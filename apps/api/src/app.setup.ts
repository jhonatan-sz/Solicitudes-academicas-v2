import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

/**
 * Configuración compartida de la aplicación (prefijo, pipes, filtros, CORS,
 * Helmet y Swagger).
 *
 * Vive fuera de `main.ts` para que los tests e2e levanten exactamente la misma
 * tubería que producción en lugar de una app "pelada".
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.use(cookieParser());

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 600,
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Solicitudes Académicas API')
      .setDescription(
        'API REST para la gestión de solicitudes académicas en la universidad. Soporta solicitudes de certificados, homologaciones, cancelaciones y más con un flujo de aprobación multirol.',
      )
      .setVersion('v1')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingrese su token de acceso JWT',
        },
        'bearer',
      )
      .addTag('Auth', 'Autenticación y gestión de usuarios')
      .addTag(
        'Requests',
        'Gestión de solicitudes académicas y flujo de aprobación',
      )
      .addTag('Documents', 'Subida, descarga y gestión de documentos adjuntos')
      .addTag('Users', 'Gestión de usuarios (solo administrador)')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Solicitudes Académicas API — Docs',
      swaggerOptions: {
        persistAuthorization: true,
        defaultModelsExpandDepth: 2,
        displayRequestDuration: true,
        filter: true,
      },
    });
  }
}
