import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
