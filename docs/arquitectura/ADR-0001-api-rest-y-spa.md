# ADR‑0001 · API REST con Laravel y SPA con React en un monorepo

| Campo | Valor |
|-------|-------|
| Estado | Aceptada (21/10/2026). Revisable si la guía oficial de Ilerna impone otra cosa (D1) |
| Sustituye | D2 del plan inicial v1 (opción A) |

## Contexto
El plan inicial proponía dos formas: A) API REST + SPA separada, B) Laravel + Inertia. Alberto pidió empezar a construir con una interfaz 3D muy interactiva y dos tipos de cliente (particular y taller). En el equipo hay PHP 8.2 y MariaDB 10.4 (XAMPP) y Node 25.

## Decisión
- `backend/`: **Laravel 12** como API JSON versionada (`/api/v1`), autenticación **Sanctum en modo SPA** (cookie de sesión + CSRF), validación con Form Requests, autorización con Policies, Eloquent sobre **MySQL/MariaDB**, tests con Pest/PHPUnit sobre SQLite en memoria.
- `frontend/`: **React 19 + TypeScript + Vite 8**, Tailwind 4 con tokens propios, React Router, TanStack Query, React Hook Form + Zod, Recharts, Motion, **React Three Fiber + drei** para el 3D.
- En desarrollo Vite reenvía `/api` y `/sanctum` a Laravel: mismo origen, sin CORS.

## Consecuencias
- La API documentada es un entregable en sí y sirve para una futura app móvil o para el asistente de IA.
- Más configuración inicial (Sanctum, proxy) a cambio de una frontera cliente/servidor clara, fácil de explicar en la defensa.
- Laravel 12 es la última versión compatible con PHP 8.2. Para pasar a Laravel 13 habrá que actualizar PHP a 8.3+.

## Cómo defenderlo
Separación de responsabilidades (presentación / reglas de negocio / persistencia), seguridad con mecanismos probados del framework y un contrato de API explícito (`docs/api/contrato-v1.md`) que permitió desarrollar backend y frontend en paralelo.
