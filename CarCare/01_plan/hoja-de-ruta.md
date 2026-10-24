# Hoja de ruta

*Última revisión: 23/10/2026 (agente producto, mapa de huecos). **Sin fechas**: dependen de D6 (calendario de entrega y defensa). No hay fechas inventadas. El estado de las oleadas sale de [`docs/equipo/TABLERO.md`](../../docs/equipo/TABLERO.md) y del informe [2026-10-23-producto-mapa-de-huecos](../../docs/equipo/informes/2026-10-23-producto-mapa-de-huecos.md).*

## Dónde estamos (23/10/2026)

- **Construcción casi terminada.**
  - De 90 historias Must y Should: 71 construidas, 7 a medias, 8 que faltan y 4 en curso.
  - La API está completa (68 rutas, 462 tests en verde según el informe del backend).
  - El particular y el taller tienen todas sus pantallas, **menos la Analítica**, que está vacía y en curso (tarea 17).
- **Huecos que se ven:**
  1. La Analítica / "Facturación" vacía.
  2. El rótulo "Facturación", que promete algo que no existe (D12).
  3. La orden de trabajo sin un resumen imprimible.
  4. Ningún "¿Has olvidado tu contraseña?" (D17).
  5. Detalles pequeños: "Mis órdenes", la actividad completa, la guía de primeros pasos y los km del año.
- **Lo que más falta es calidad, no funciones.** Todavía no existen:
  - E2E;
  - la auditoría de accesibilidad;
  - la auditoría de seguridad;
  - la CI;
  - los manuales.

  Por eso ninguna historia está todavía en `Hecho`.
- **Siguiente paso:**
  1. Terminar las tareas 16, 17, 19 y 20, que están en curso.
  2. Hacer las tareas propuestas 22‑30 del informe de huecos.
  3. Integración (tarea 5) y después la oleada de calidad (tareas 6‑11).

## Cómo se trabaja ahora

Desde el 21/10/2026 el trabajo se organiza en **oleadas** de un equipo de agentes: cada agente es dueño de una zona y entrega un informe con evidencias. El ciclo está en [`docs/equipo/GUIA-LIDERAZGO.md`](../../docs/equipo/GUIA-LIDERAZGO.md) §4. Cuando se conozca D6, las oleadas se encajarán en sprints con fecha.

## Oleadas

| Oleada | Objetivo | Agentes | Épicas / historias | Estado (23/10/2026) |
|--------|----------|---------|--------------------|---------------------|
| 0 | Andamiaje (Laravel 12, React + Vite), contrato de API, ADR 0001‑0004, equipo de agentes | Sesión principal (arquitecto) | E0‑1 (parte), base de todo | **Hecho** (21/10/2026) |
| 1 (1b, 1c, 1d) | Construcción en paralelo contra el contrato v1 | backend-laravel ∥ frontend-react ∥ experto-3d ∥ documentador-tfg (+ producto: backlog y decisiones) | E1‑E5, E7‑E15 según el contrato; E6‑1, E6‑4; E0‑3 | **Casi terminada.** API completa; pantallas del particular y del taller hechas (commit 779dc5c) salvo la Analítica (tarea 17). En curso también: simplificación (16), datos demo (19) y rendimiento 3D (20) |
| 1e *(propuesta de producto)* | Cerrar los huecos visibles | frontend-react ×2 ∥ arquitecto → backend-laravel | Tareas propuestas 22‑29 del [mapa de huecos](../../docs/equipo/informes/2026-10-23-producto-mapa-de-huecos.md): rótulos sin promesas falsas, analítica del taller, "Mis órdenes", actividad, primeros pasos; y, si Alberto lo decide, resumen de la orden (D12) y recuperar contraseña (D17) | Pendiente |
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
| H2 | Base técnica | Oleada 0 (andamiaje, contrato, ADR) hecha; scripts de arranque hechos (`iniciar-carcare.bat`, `scripts/servidor-api.cmd`). Falta CI (E0‑2, tarea 11) | _por definir_ | En curso |
| H3 | Construcción completa del contrato v1 | Oleada 1: API, SPA particular + taller, 3D, documentación. A 23/10: 71 de 90 historias Must y Should construidas; falta sobre todo la Analítica (tarea 17) y los huecos de la oleada 1e | _por definir_ | En curso (casi terminada) |
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
