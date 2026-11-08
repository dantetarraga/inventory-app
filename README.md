# StockPRO v2

Sistema de inventario multiempresa: productos, categorías, marcas, almacenes, kardex de
entradas/salidas/ajustes, usuarios con permisos por módulo, dashboard y reportes en PDF/Excel.

Reescritura de [`inventarios-v1-ready`](https://github.com/fantasma369to/inventarios-v1-ready)
(React + Supabase desde el navegador) con backend propio, PostgreSQL y buenas prácticas.

## Stack

| Capa                           | Tecnología                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Monorepo                       | pnpm workspaces · TypeScript estricto · ESLint + Prettier                                                              |
| API (`apps/api`)               | Fastify 5 · Zod (validación + OpenAPI) · Drizzle ORM · PostgreSQL 17 · argon2 · JWT + refresh token rotativo           |
| Web (`apps/web`)               | React 19 · Vite · TanStack Router/Query/Table · react-hook-form · Tailwind v4 + Radix · Recharts · @react-pdf/renderer |
| Compartido (`packages/shared`) | Esquemas Zod y tipos usados por API y web                                                                              |
| Calidad                        | Vitest (integración contra Postgres real) · Playwright (E2E) · GitHub Actions                                          |

## Requisitos

- Node 20.19+ (recomendado 24, ver `.nvmrc`) y `corepack enable` (usa pnpm 10)
- Docker (para PostgreSQL)

## Puesta en marcha

```bash
cp .env.example .env          # cambia POSTGRES_PASSWORD y JWT_SECRET
pnpm install
pnpm db:up                    # PostgreSQL en localhost:5433
pnpm db:migrate
pnpm db:seed                  # opcional: empresa demo
pnpm dev                      # API :3000 · Web :5173
```

Usuario demo: `admin@stockpro.dev` / `Demo12345`. Swagger (solo dev): http://localhost:3000/docs

### Stack completo en Docker (similar a producción)

```bash
docker compose --profile full up --build     # http://localhost:8080
```

La API aplica migraciones al arrancar; nginx sirve la web y hace proxy de `/api`.

## Scripts

| Comando                        | Qué hace                                                           |
| ------------------------------ | ------------------------------------------------------------------ |
| `pnpm dev`                     | API y web en modo desarrollo                                       |
| `pnpm lint` / `pnpm typecheck` | Lint y tipos de todo el monorepo                                   |
| `pnpm test`                    | Tests de integración de la API (crea la BD `stockpro_test`)        |
| `pnpm e2e`                     | Tests E2E con Playwright (levanta `pnpm dev` si no está corriendo) |
| `pnpm db:generate`             | Genera una migración desde `apps/api/src/db/schema.ts`             |
| `pnpm build`                   | Build de producción                                                |

## Arquitectura y decisiones

- **El navegador nunca habla con la BD.** Toda regla de negocio y autorización vive en la API.
- **Multi-tenant:** cada consulta se filtra por `company_id` del usuario autenticado; las
  referencias (marca, categoría, almacén) se validan contra la misma empresa.
- **Stock solo cambia vía kardex.** `registerMovement` bloquea la fila de stock
  (`SELECT … FOR UPDATE`) dentro de una transacción; un `CHECK (quantity >= 0)` impide
  stock negativo incluso con salidas concurrentes. Los movimientos son inmutables
  (las correcciones son ajustes) y guardan el saldo resultante.
- **Dinero y cantidades** son `numeric` en Postgres y viajan como string; nunca se operan como float.
- **Auth:** contraseñas con argon2id; access token JWT de 15 min en memoria; refresh token
  opaco en cookie `httpOnly; Secure; SameSite=Strict`, guardado hasheado, rotado en cada uso y
  con detección de reutilización (revoca la familia). Endpoints con cookie exigen la cabecera
  `X-Requested-With` (CSRF). Rate limit en login/registro.
- **Permisos por módulo** (`products`, `kardex`, `reports`, `categories`, `brands`,
  `warehouses`, `users`, `company`); los administradores tienen todos. Se verifican en cada
  request, así que desactivar a un usuario o quitarle permisos aplica de inmediato. Solo un
  administrador puede crear o modificar administradores.
- **Errores** en formato RFC 7807 (`application/problem+json`) con errores por campo que la web
  muestra en los formularios.
- **Auditoría:** cada cambio queda registrado en `audit_log`.
- **Productos** se eliminan de forma lógica para conservar su historial.

## Estructura

```
apps/api/src
  app.ts, server.ts, env.ts
  db/            schema.ts, client.ts, migrate.ts, seed.ts   (migraciones en apps/api/drizzle)
  plugins/       auth (JWT + permisos), errors (problem+json)
  modules/<x>/   routes.ts (+ service.ts cuando hay lógica)
apps/api/test    tests de integración (Vitest + app.inject)
apps/web/src
  routes/        rutas file-based de TanStack Router (_app = zona autenticada)
  features/      api.ts (query options + mutations), reports/pdf.tsx
  components/    ui/ (botones, diálogos, tabla…), layout/
  lib/           http (fetch + refresh), query, guards, format
  stores/        Zustand solo para sesión y tema (nada de datos del servidor)
apps/web/e2e     tests Playwright
packages/shared  esquemas Zod compartidos
```
