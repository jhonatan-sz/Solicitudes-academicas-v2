# API — Solicitudes Académicas

Backend en **NestJS 11 + Prisma 7 + PostgreSQL** del sistema de solicitudes
académicas. Documentación completa del proyecto en el
[README raíz](../../README.md).

## Puesta en marcha

```bash
npm ci
npx prisma generate

cp .env.example .env      # ajusta DATABASE_URL y los secretos JWT
npx prisma migrate deploy
npx prisma db seed

npm run start:dev         # http://localhost:3000/api
```

Swagger: <http://localhost:3000/api/docs>

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Servidor en modo watch |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta `dist/main` |
| `npm run lint` | ESLint (sin modificar archivos) |
| `npm run lint:fix` | ESLint con `--fix` |
| `npm test` | Tests unitarios de la máquina de estados y RBAC |
| `npm run test:e2e` | Smoke test contra `/api/health` (requiere PostgreSQL) |

## Estructura

```
src/
  common/        filtros globales, guards, RBAC y decoradores
  config/        validación de variables de entorno (Joi)
  modules/
    auth/                login, refresh tokens, /auth/me
    users/               CRUD de usuarios y perfiles
    requests/            solicitudes y tipos de solicitud
    documents/           adjuntos con almacenamiento local
    official-documents/  generación de PDF con QR
    notifications/       notificaciones y envío de correo opcional
    health/              health check
  prisma/        PrismaService
```

La regla de negocio central vive en
`src/common/rbac/request-workflow.rules.ts`: una máquina de estados pura (sin
dependencias de Nest ni acceso a la base de datos; solo los enums de Prisma)
cubierta por 58 tests.
