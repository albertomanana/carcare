# CarCare

> *Your car. Your data. Your control.*

Plataforma SaaS para gestionar la vida de un vehículo, con interfaz 3D interactiva, para **particulares** (seguimiento diario de su coche) y **talleres** (clientes, flota, órdenes de trabajo y elevadores). TFG de Desarrollo de Aplicaciones Web (Ilerna).

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `backend/` | API REST Laravel 12 (PHP 8.2) + MySQL/MariaDB |
| `frontend/` | SPA React 19 + TypeScript + Vite + Tailwind + React Three Fiber |
| `docs/` | Contrato de API, decisiones de arquitectura (ADR), documentación del TFG y del equipo |
| `CarCare/` | Planificación: backlog, decisiones, ideas, sesiones, investigación |
| `Car_Care_Documentacion/` | Documentación original del proyecto (solo lectura) |
| `.claude/agents/` | Equipo de agentes de Claude Code |

## Arranque rápido (Windows + XAMPP)

Requisitos: XAMPP (MySQL), PHP 8.2+, Node 20+.

**Un clic:** doble clic en `iniciar-carcare.bat`. Comprueba MySQL, instala dependencias si faltan, abre la API y la web en dos ventanas y lanza el navegador en http://localhost:5173.

**A mano:**

```bash
# 1. Backend
cd backend
../.tools/composer install          # o "composer install" si lo tienes instalado
php artisan migrate:fresh --seed    # crea tablas y datos demo
php artisan serve                   # http://127.0.0.1:8000

# 2. Frontend (otra terminal)
cd frontend
npm install
npm run dev                         # http://localhost:5173
```

Cuentas demo (contraseña `password`): `demo@carcare.test` (particular) y `taller@carcare.test` (taller).

## Trabajar con el equipo de agentes

Lee [`docs/equipo/GUIA-LIDERAZGO.md`](docs/equipo/GUIA-LIDERAZGO.md). Reglas del proyecto en [`CLAUDE.md`](CLAUDE.md).
