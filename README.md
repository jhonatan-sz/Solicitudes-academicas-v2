<div align="center">

# Solicitudes Académicas

**Sistema de gestión de solicitudes académicas con flujo de aprobación por estados y control de acceso por roles.**

[![CI](https://github.com/jhonatan-sz/solicitudes-academicas/actions/workflows/ci.yml/badge.svg)](https://github.com/jhonatan-sz/solicitudes-academicas/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

NestJS 11 · Prisma 7 · PostgreSQL · React 19 · TypeScript

</div>

---

## Qué es

Plataforma para que estudiantes radiquen trámites académicos (certificados,
homologaciones, cancelaciones, paz y salvo, recursos) y para que funcionarios,
coordinadores y administradores los gestionen **sin salirse del flujo
institucional**.

El proyecto nació como trabajo de universidad y lo reescribí después para
practicar lo que me interesa: **modelado de dominio, reglas de autorización y
testing**. La interfaz es la cara visible; la parte que me interesa mostrar es
el backend.

> Proyecto académico, no está desplegado en producción. Se levanta en local con
> PostgreSQL y npm (ver [Cómo correrlo](#cómo-correrlo)).

## Capturas

| Inicio de sesión | Dashboard del estudiante |
|---|---|
| ![Login](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard-estudiante.png) |

| Bandeja de solicitudes | Detalle con historial de estados |
|---|---|
| ![Solicitudes](docs/screenshots/solicitudes.png) | ![Detalle](docs/screenshots/detalle-solicitud.png) |

<div align="center">

**Administración de usuarios**

![Admin](docs/screenshots/admin-usuarios.png)

</div>

## Roles

| Rol | Puede hacer |
|---|---|
| **STUDENT** | Crear sus solicitudes, editarlas en borrador, enviarlas, cancelarlas, subir y borrar sus documentos |
| **STAFF** | Mover solicitudes a revisión y solicitar documentos faltantes. **No aprueba ni rechaza** |
| **COORDINATOR** | Aprobar o rechazar en revisión y generar documentos oficiales. **No opera el flujo documental** |
| **ADMIN** | Todas las acciones operativas de STAFF y COORDINATOR, **sin saltarse el workflow** |

## Flujo de estados

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED: estudiante envía
    DRAFT --> CANCELLED
    SUBMITTED --> IN_REVIEW: funcionario recibe
    SUBMITTED --> PENDING_DOCUMENTS
    SUBMITTED --> CANCELLED
    IN_REVIEW --> APPROVED: coordinador aprueba
    IN_REVIEW --> REJECTED: coordinador rechaza (exige motivo)
    IN_REVIEW --> PENDING_DOCUMENTS: falta documentación
    PENDING_DOCUMENTS --> IN_REVIEW: estudiante subsana
    PENDING_DOCUMENTS --> CANCELLED
    APPROVED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
```

`APPROVED`, `REJECTED` y `CANCELLED` son **inmutables**: no admiten más
transiciones, ni edición de datos, ni carga de documentos. Rechazar exige un
comentario de mínimo 10 caracteres.

## Arquitectura

```mermaid
flowchart LR
    SPA["React SPA<br/>Vite + Tailwind"] -->|REST /api| API["NestJS API"]
    API --> AUTH["Auth<br/>JWT + refresh"]
    API --> REQ["Solicitudes<br/>máquina de estados"]
    API --> DOC["Documentos<br/>adjuntos"]
    API --> OFF["Documentos oficiales<br/>PDF + QR"]
    API --> NOT["Notificaciones<br/>sistema / correo"]
    API --> DB[(PostgreSQL)]
    NOT -.opcional.-> RESEND["Resend"]
```

## Stack

| Capa | Tecnología |
|---|---|
| API | NestJS 11, TypeScript 5.7, Swagger, Helmet, Throttler |
| Persistencia | PostgreSQL, Prisma 7, migraciones versionadas |
| Sesión | JWT (15 min) + refresh token en cookie `httpOnly` (7 días), hash del refresh en BD |
| Frontend | React 19, React Router 7, TanStack Query, React Hook Form + Zod, Tailwind 4 |
| Documentos | PDF con `pdfkit` + QR con `qrcode`, almacenamiento local |
| Tests | Jest (unitarios), Supertest (smoke e2e) |
| CI | GitHub Actions (lint, tests, build de API y web) |

## Cómo correrlo

Requisitos: Node 20+, PostgreSQL 14+ (o Docker).

### 1. Base de datos

Con Docker:

```bash
docker compose up -d
export DATABASE_URL="postgresql://solicitudes:solicitudes@localhost:5433/solicitudes"
```

Con un PostgreSQL ya instalado:

```bash
createdb solicitudes
export DATABASE_URL="postgresql://tu_usuario@localhost:5432/solicitudes"
```

### 2. API

```bash
cd apps/api
npm ci
npx prisma generate
cp .env.example .env          # ajusta DATABASE_URL y los secretos JWT (mín. 32 caracteres)
npx prisma migrate deploy
npx prisma db seed
npm run start:dev             # http://localhost:3000/api  ·  Swagger en /api/docs
```

### 3. Web

```bash
cd apps/web
npm ci
cp .env.example .env          # VITE_API_URL=http://localhost:3000
npm run dev                   # http://localhost:5173
```

### Cuentas de demostración

El seed crea datos ficticios: 5 usuarios, 6 solicitudes en distintos estados y
sus historiales. Contraseña para todas: `Demo1234!`.

| Correo | Rol |
|---|---|
| `estudiante@demo.edu.co` | STUDENT |
| `camila@demo.edu.co` | STUDENT |
| `funcionario@demo.edu.co` | STAFF |
| `coordinador@demo.edu.co` | COORDINATOR |
| `admin@demo.edu.co` | ADMIN |

> El seed es idempotente: se puede volver a ejecutar sin duplicar datos.

## Endpoints principales

Todos bajo `/api` (documentación completa en Swagger):

| Recurso | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Solicitudes | `GET/POST /requests`, `GET/PATCH /requests/:id`, `POST /requests/:id/submit`, `POST /requests/:id/cancel`, `PATCH /requests/:id/status` |
| Tipos de solicitud | `GET/POST /requests/types`, `PATCH/DELETE /requests/types/:id` |
| Documentos | `POST /documents/upload`, `GET /documents/:id/download`, `DELETE /documents/:id` |
| Documentos oficiales | `POST /requests/:id/official-documents`, `GET /official-documents/:id/download` |
| Usuarios | CRUD en `/users` (solo ADMIN) |
| Salud | `GET /health` |

## Decisiones de ingeniería

1. **La regla de negocio es código puro, no `if`s dispersos.** Las matrices de
   transición por rol viven en `request-workflow.rules.ts`, sin dependencias de
   Nest ni acceso a la base de datos: solo usa los enums generados por Prisma
   (`RequestStatus`, `RoleName`). Se testean en milisegundos y el servicio solo
   las invoca.
2. **ADMIN no es un comodín.** Tiene la unión de las capacidades de STAFF y
   COORDINATOR, pero sigue sujeto a las transiciones válidas: si el workflow no
   permite `DRAFT -> APPROVED`, el admin tampoco puede.
3. **Refresh tokens rotativos.** El token viaja en cookie `httpOnly`; en la base
   de datos solo se guarda su hash. Cada refresh invalida el anterior.
4. **La configuración falla al arrancar.** Joi valida `DATABASE_URL` y los
   secretos JWT antes de levantar la app, en vez de fallar en la primera
   petición.
5. **`SELECT` explícito en las consultas.** El `passwordHash` nunca sale de la
   base de datos por accidente.

## Calidad

```bash
cd apps/api && npm test          # 58 tests: máquina de estados + RBAC
cd apps/api && npm run test:e2e  # smoke test de arranque (requiere PostgreSQL)
cd apps/api && npm run lint
cd apps/web && npm run lint
```

El CI corre lint, tests y build de la API (además del smoke e2e contra un
PostgreSQL de servicio) y lint y build de la web en cada push y PR a `main`.

## Estructura

```
apps/
  api/    NestJS: auth, users, requests, documents, official-documents, notifications
  web/    React: login, dashboard, solicitudes, documentos, notificaciones, admin
docs/
  screenshots/
docker-compose.yml
```

## Limitaciones y siguientes pasos

- Sin despliegue público: falta un entorno (API + web + base de datos) para una
  demo en vivo.
- El frontend no tiene tests automatizados; la cobertura está concentrada en el
  backend.
- El envío de correo depende de una `RESEND_API_KEY` opcional: sin ella, las
  notificaciones quedan solo en base de datos.
- El `e2e` es un smoke test de arranque, no un flujo completo de negocio.
- Pendiente: subida de adjuntos a almacenamiento externo (el `.env` contempla
  Cloudinary, el proveedor implementado es local).

## Licencia

[MIT](LICENSE)
