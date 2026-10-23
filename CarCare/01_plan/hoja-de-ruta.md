# Hoja de ruta

*Última revisión: 21/10/2026 (agente producto). **Sin fechas**: dependen de D6 (calendario de entrega y defensa). No hay fechas inventadas. El estado de las oleadas sale de [`docs/equipo/TABLERO.md`](../../docs/equipo/TABLERO.md).*

## Cómo se trabaja ahora

Desde el 21/10/2026 el trabajo se organiza en **oleadas** de un equipo de agentes: cada agente es dueño de una zona y entrega un informe con evidencias. El ciclo está en [`docs/equipo/GUIA-LIDERAZGO.md`](../../docs/equipo/GUIA-LIDERAZGO.md) §4. Cuando se conozca D6, las oleadas se encajarán en sprints con fecha.

## Oleadas

| Oleada | Objetivo | Agentes | Épicas / historias | Estado (21/10/2026) |
|--------|----------|---------|--------------------|---------------------|
| 0 | Andamiaje (Laravel 12, React + Vite), contrato de API, ADR 0001‑0004, equipo de agentes | Sesión principal (arquitecto) | E0‑1 (parte), base de todo | **Hecho** (21/10/2026) |
| 1 | Construcción en paralelo contra el contrato v1 | backend-laravel ∥ frontend-react ∥ experto-3d ∥ documentador-tfg (+ producto: backlog y decisiones) | E1‑E5, E7‑E15 según el contrato; E6‑1, E6‑4; E0‑3 | **En curso** |
| 2 | Integración real API ↔ SPA y corrección de desajustes | Sesión principal + agentes dueños | Cerrar el **núcleo defendible**; primer E2E de login (R6) | Pendiente |
| 3 | Calidad: E2E, accesibilidad, seguridad, revisión UX | qa-tester ∥ seguridad ∥ disenador-ux | E6‑2, E6‑3, E6‑5; verificación de E14‑6/E14‑7 | Pendiente |
| 4 | Correcciones, CI, scripts de arranque, manuales | Agentes dueños + devops + documentador-tfg | E0‑1 (scripts), E0‑2 (CI, necesita D5), manuales | Pendiente |
| 5 *(propuesta de producto, aún no está en el tablero)* | Validación con usuarios y decisión de alcance de la fase 2 | producto (+ Alberto en las sesiones) | E6‑6: 3‑5 particulares y 2‑3 talleres con el [guion](../06_investigacion/guion-prueba-usuarios.md); revisar D9, D10, D13 con resultados reales | Pendiente |

**Recomendación de producto:** empezar a **reclutar** participantes durante la oleada 2 (sobre todo talleres, R16), para que la oleada 5 no se retrase esperando a gente.

## Hitos

| # | Hito | Contenido | Fecha objetivo | Estado |
|---|------|-----------|----------------|--------|
| H0 | Plan aprobado | D2, D3 y D4 aceptadas provisionalmente; D7 y D8 tomadas por Alberto. **Faltan D1, D5 (remoto), D6, D9, D15** | _por definir (D6)_ | En curso |
| H1 | Prototipo visual | **Sustituido**: no se hizo un prototipo aparte; se construye directamente contra el contrato (oleada 1). La validación visual con usuarios pasa a H7. | — | Sustituido |
| H2 | Base técnica | Oleada 0 (andamiaje, contrato, ADR) hecha. Faltan CI (E0‑2) y scripts de arranque (oleada 4) | _por definir_ | En curso |
| H3 | Construcción completa del contrato v1 | Oleada 1: API, SPA particular + taller, 3D, documentación | _por definir_ | En curso |
| H4 | Núcleo integrado | Oleada 2: el núcleo defendible funciona de punta a punta con datos reales | _por definir_ | Pendiente |
| H5 | Calidad verificada | Oleada 3: E2E de los recorridos particular y taller, axe sin críticos, auditoría de seguridad sin incidencias altas abiertas | _por definir_ | Pendiente |
| H6 | Versión entregable | Oleada 4: CI en verde, arranque documentado, manuales; versiones de entorno con soporte (D15) | _por definir_ | Pendiente |
| H7 | Validación con usuarios | Oleada 5: pruebas guiadas y conclusiones reales en `06_investigacion/` | _por definir_ | Pendiente |
| H8 | Memoria y defensa | Memoria completa (documentador-tfg), demo ensayada en el equipo de la defensa, vídeo de respaldo (D14) | _por definir (D6)_ | Pendiente |

## Puntos de decisión de alcance

- **Al conocer D6:** comparar el tiempo restante con lo que queda del núcleo. Si no cabe, aplicar D9 (orden de recorte).
- **Al cerrar la oleada 2:** con historias realmente integradas, decidir si se pule el 3D (E12‑7, E14‑1, E14‑4) o se recorta.
- **Al cerrar la oleada 5:** decidir la fase 2 (D13 puente taller ↔ particular, D10 modelo de negocio) con datos de usuarios, no con suposiciones.

## Sprints

Cuando haya fechas (D6), copia este bloque por cada sprint:

```
### Sprint N · dd/mm – dd/mm
Oleada:
Objetivo:
Historias: E?-?, E?-?
Riesgos de este sprint:
Resultado (al cerrar, con enlace a informes):
```
