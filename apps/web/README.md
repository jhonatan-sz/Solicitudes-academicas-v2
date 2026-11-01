# Web — Solicitudes Académicas

Frontend en **React 19 + TypeScript + Vite + Tailwind 4** del sistema de
solicitudes académicas. Documentación completa del proyecto en el
[README raíz](../../README.md).

## Puesta en marcha

Requiere la API corriendo en `http://localhost:3000` (ver
[`apps/api`](../api/README.md)).

```bash
npm ci
cp .env.example .env      # VITE_API_URL apuntando a la API
npm run dev               # http://localhost:5173
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Type-check + build de producción a `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Sirve el build local |

## Estructura

```
src/
  app/          router, layouts y providers (auth, tema, query)
  features/     lógica por dominio: auth, requests, admin, dashboard
  pages/        pantallas: login, dashboard, solicitudes, documentos, admin
  shared/       componentes UI (shadcn), api client, hooks, tipos
```

La sesión se mantiene con un access token en memoria y un refresh token en
cookie `httpOnly`; al recargar, el cliente renueva la sesión contra
`/api/auth/refresh`.
