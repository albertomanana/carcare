# Cómo se trabaja en este repositorio

## Ramas (solo dos permanentes)

| Rama | Para qué | Quién escribe |
|------|----------|---------------|
| `main` | **Versión estable y entregable.** Lo que se enseña al tutor o al tribunal. Solo cambia al cerrar un hito, mediante *pull request* desde `develop`, y cada vez se etiqueta (`v0.1`, `v0.2`…). | Nadie hace commit directo |
| `develop` | **Trabajo diario.** Cada sesión (con Alberto o del piloto automático) termina con sus commits aquí y un `push`. | Sesiones de trabajo |

Solo si un cambio es grande o arriesgado se abre una rama temporal `feature/<tema>` desde `develop`, que se fusiona con PR y se borra. No hay más ramas.

```text
main     ●───────────────────────●──────────────── v0.1 ──── …
          \                     ↗ PR "Hito v0.1"
develop    ●──●──●──●──●──●──●──●──●──●──●──●──…   (un bloque de commits por sesión)
```

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/es/) en español:

```text
tipo(ámbito): resumen en presente y en minúscula
```

- **tipo:** `feat` (función nueva), `fix` (corrección), `test`, `docs`, `refactor`, `style`, `chore` (mantenimiento, scripts, configuración).
- **ámbito:** `backend`, `frontend`, `3d`, `api` (contrato), `docs`, `plan` (carpeta `CarCare/`), `equipo`, `scripts`.
- Ejemplos: `feat(frontend): tablero kanban de órdenes con teclado` · `test(backend): aislamiento 404 en todos los endpoints` · `docs(plan): nota de la sesión del 23/10`.

**Al terminar cada sesión:** un commit por área tocada (no un único commit gigante), con el detalle en el cuerpo del mensaje, y `git push origin develop`.

## Hitos (merge a `main`)

| Etiqueta | Hito | Criterio |
|----------|------|----------|
| `v0.1` | Primera versión mostrable | Todas las pantallas con datos reales; tests de backend y build del frontend en verde |
| `v0.2` | Calidad | E2E, auditoría de seguridad y revisión de accesibilidad con los hallazgos críticos corregidos |
| `v0.3` | Documentación del TFG | Memoria, diagramas y manuales al día con el código |
| `v1.0` | Entrega del TFG | Versión que se entrega y se defiende |

El PR de `develop` a `main` usa la plantilla de `.github/pull_request_template.md`.

## Nunca

- Commit directo o `push --force` a `main`.
- Subir secretos: los `.env` están en `.gitignore` y no se leen ni se imprimen.
- Subir dependencias (`vendor/`, `node_modules/`) ni archivos subidos por usuarios (`backend/storage/`).

Reglas del proyecto y del equipo de agentes: [`CLAUDE.md`](CLAUDE.md) · [`docs/equipo/GUIA-LIDERAZGO.md`](docs/equipo/GUIA-LIDERAZGO.md).
