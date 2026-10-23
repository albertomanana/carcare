# Tablero del equipo

*Cada agente actualiza **su fila** al empezar (`En curso`) y al terminar (`Hecho` / `Bloqueado`) un encargo, con enlace a su informe. Estados: `Libre` · `En curso` · `Hecho` · `Bloqueado`.*

## Estado por agente

| Agente | Encargo actual | Estado | Último informe | Bloqueos |
|--------|----------------|--------|----------------|----------|
| **Sesión interactiva** (Alberto + sesión principal) | Oleada 1c (4 agentes) y montaje del piloto automático. Inicio: 2026-10-23 | En curso | — | — |
| **Piloto automático** | Ver [AUTOPILOTO.md](AUTOPILOTO.md). Prueba del 23/10 01:16 superada y detenida (tareas descartadas por D16) | Libre | — | — |
| arquitecto | Contrato v1, ADR 0001‑0004, reparto de la oleada 1 (sesión principal) | Hecho | — | — |
| producto | Backlog E0‑E15 contra el contrato v1, decisiones D1‑D15, riesgos, competencia con fuentes, guion de pruebas con usuarios | Hecho | [2026-10-21-producto-backlog-y-decisiones](informes/2026-10-21-producto-backlog-y-decisiones.md) | Esperan a Alberto: D6, D1, D9, D15 |
| backend-laravel | Oleada 1: API v1 completa | En curso | — | — |
| frontend-react | Oleada 1: SPA completa (particular + taller) | En curso | — | — |
| frontend-react (taller) | Oleada 1c: terminar el modo taller (centro de control, órdenes kanban+lista, detalle/nueva orden, clientes, equipo, taller 3D, órdenes del vehículo) | En curso | — | — |
| experto-3d | Oleada 1: coche 3D, zonas, rayos X, taller 3D, portada | En curso | — | — |
| disenador-ux | — | Libre | — | — |
| qa-tester | — | Libre | — | — |
| seguridad | — | Libre | — | — |
| devops | — | Libre | — | — |
| documentador-tfg | Oleada 1: requisitos, diagramas y documentación técnica | En curso | — | — |

## Oleadas de trabajo

| Oleada | Objetivo | Agentes | Estado |
|--------|----------|---------|--------|
| 0 | Andamiaje (Laravel 12, React+Vite), contrato de API, ADRs, equipo | sesión principal | Hecho (21/10/2026) |
| 1 | Construcción en paralelo contra el contrato | backend-laravel ∥ frontend-react ∥ experto-3d ∥ documentador-tfg | Interrumpida el 21/10 por límite de uso (solo producto terminó) |
| 1b | Reanudación (22/10): cerrar API + demo, login/registro + integración, módulo 3D. Objetivo: **primera versión mostrable** | backend-laravel ∥ frontend-react (particular) ∥ frontend-react (taller) ∥ experto-3d | En curso. Verificado por la sesión principal (22/10): login demo/taller, garaje, ficha con 3D y zonas, diario y gastos funcionan con datos reales. Pendiente: cabina, modo taller, formularios, agenda, analítica, informe, ajustes |
| 1c | Reanudación (23/10) tras nuevo límite de uso: pantallas particulares restantes ∥ modo taller ∥ tests API ∥ taller 3D + portada | frontend-react ×2 ∥ backend-laravel ∥ experto-3d | En curso |
| 2 | Integración real API ↔ SPA, corrección de desajustes | sesión principal + agentes dueños | Pendiente |
| 3 | Calidad: E2E, accesibilidad, seguridad, revisión UX | qa-tester ∥ seguridad ∥ disenador-ux | Pendiente |
| 4 | Correcciones, CI, scripts de arranque, manuales | agentes dueños + devops + documentador-tfg | Pendiente |

## Peticiones entre agentes

*Cuando un agente necesita algo fuera de su zona, lo apunta aquí. El destinatario lo marca como resuelto.*

| # | De | Para | Petición | Estado |
|---|----|------|----------|--------|
| | | | | |
