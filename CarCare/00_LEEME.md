# CarCare · espacio de planificación

Carpeta de trabajo para planificar e idear CarCare (TFG de DAW y posible producto). Aquí no hay código: solo planes, decisiones, ideas y notas.

*Creado el 21 de octubre de 2026 a partir del plan inicial (v1, 20/10/2026).*

## Cómo está organizada

| Carpeta | Para qué sirve | Empieza por |
|---------|----------------|-------------|
| `01_plan/` | Visión, alcance, hoja de ruta, riesgos y copia del plan inicial v1 | `plan-general.md` |
| `02_backlog/` | Épicas e historias del MVP con su estado | `backlog-mvp.md` |
| `03_decisiones/` | Decisiones pendientes y tomadas (con su porqué) | `registro-decisiones.md` |
| `04_ideas/` | Ideas sueltas antes de convertirse en historias | `banco-ideas.md` |
| `05_sesiones/` | Una nota por sesión de trabajo | `_plantilla-sesion.md` |
| `06_investigacion/` | Competencia, entrevistas a usuarios, pruebas técnicas | `_plantilla-entrevista.md` |
| `07_memoria-tfg/` | Estructura y seguimiento de la memoria del TFG | `estructura-memoria.md` |

Los archivos que empiezan por `_plantilla-` no se rellenan: se **copian** y se renombran.

## Flujo de trabajo propuesto

1. **Idea** → la apuntas en `04_ideas/banco-ideas.md` (una línea basta).
2. **Evaluar** → si merece la pena, la desarrollas con `_plantilla-idea.md`.
3. **Decidir** → si cambia arquitectura, alcance o datos, abres una decisión en `03_decisiones/`.
4. **Planificar** → si entra, se convierte en historia del backlog con criterios de aceptación.
5. **Registrar** → al final de cada sesión, una nota en `05_sesiones/` con lo hecho y lo siguiente.

## Convenciones

- Nombres de archivo en minúsculas, con guiones y fecha ISO cuando aplique: `2026-10-21-arranque.md`.
- Estados: `Pendiente` · `En curso` · `Hecho` · `Bloqueado` · `Descartado`.
- Prioridad MoSCoW: `Must` · `Should` · `Could` · `Won't (por ahora)`.
- Regla de producto: **ninguna cifra ni función sin fuente real**. Si algo depende de datos que no tenemos, se marca así.
- ⚠️ *Depende de Ilerna* marca lo que no se puede cerrar sin la normativa oficial del TFG.

## Estado ahora mismo

*Actualizado el 21/10/2026 (agente producto).*

- **Alcance ampliado** por petición de Alberto: particular + taller (D7) e interfaz 3D (D8). D2, D3 y D4 se aceptaron provisionalmente al arrancar la construcción (ADR 0001‑0004).
- **Pendientes para Alberto:** D6 calendario, D1 guía de Ilerna, D9 orden de recorte, D15 versiones sin soporte, D5 remoto en GitHub, D12 facturación, D13 puente taller ↔ particular, D10/D11 negocio, D14 despliegue (ver `03_decisiones/registro-decisiones.md`).
- **Código:** repositorio Git local creado (sin commits ni remoto). Oleada 1 del equipo de agentes en curso (ver `docs/equipo/TABLERO.md`).
- **Backlog** reestructurado en E0‑E15 contra el contrato v1 (`02_backlog/backlog-mvp.md`). Hay competencia investigada y un guion de pruebas con usuarios en `06_investigacion/`.
- Falta la guía oficial del proyecto de Ilerna (la plantilla Word que hay es de la URJC).
