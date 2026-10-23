# Documentación del TFG de CarCare

Esta carpeta reúne la documentación de análisis, diseño, pruebas y (más adelante) manuales del Trabajo de Fin de Grado del ciclo DAW (Ilerna) de Alberto. Es la materia prima de la **memoria**: cada documento está pensado para trasladarse, con pocos cambios, a un capítulo o anexo.

*Mantenida por el agente `documentador-tfg`. Última revisión: 21/10/2026 (oleada 1).*

> ⚠️ **Depende de Ilerna.** La normativa oficial del módulo de Proyecto aún no está disponible (la plantilla Word que hay es de la URJC y solo aporta portada y estilos). La estructura de la memoria que se usa aquí es **provisional** y se mantiene en [`CarCare/07_memoria-tfg/estructura-memoria.md`](../../CarCare/07_memoria-tfg/estructura-memoria.md). Cuando llegue la guía oficial se reordenarán los capítulos sin rehacer el contenido.

## Documentos

| # | Documento | Contenido | Estado |
|---|-----------|-----------|--------|
| 1 | [01‑requisitos.md](01-requisitos.md) | 69 requisitos funcionales por módulo (particular, taller y 3D) con prioridad, permisos y trazabilidad a endpoints e historias; 18 no funcionales; huecos detectados en el contrato | Borrador de análisis |
| 2 | [02‑casos-de-uso.md](02-casos-de-uso.md) | Actores, diagrama de casos de uso, catálogo y especificación de 10 casos principales | Borrador de análisis |
| 3 | [03‑modelo-de-datos.md](03-modelo-de-datos.md) | Diagrama entidad‑relación, cardinalidades, enumerados, decisiones de diseño, índices y verificación contra migraciones | Verificado contra migraciones (ver §3.6) |
| 4 | [04‑arquitectura.md](04-arquitectura.md) | Arquitectura cliente/servidor, capas, Sanctum SPA, espacios y roles, transacciones, documentos, estrategia 3D, entornos | Diseño (piezas verificadas marcadas) |
| 5 | [05‑diagramas-secuencia.md](05-diagramas-secuencia.md) | Secuencias de login, intervención con gasto vinculado, entrega de orden y recordatorio recurrente; estados de la orden de trabajo | Diseño, pendiente de verificar contra el código |
| 6 | [06‑diagrama-clases.md](06-diagrama-clases.md) | Modelo de dominio, enumerados, servicios y policies | Mixto: modelos y enumerados contrastados; servicios y policies en diseño |
| 7 | [07‑plan-de-pruebas.md](07-plan-de-pruebas.md) | Estrategia por niveles, casos críticos, matriz requisito → prueba; resultados **vacíos** hasta tener ejecuciones reales | Plan |
| 8 | [08‑glosario.md](08-glosario.md) | Términos del dominio y técnicos | Completo para la oleada 1 |

**Pendientes** (oleadas siguientes): manual de instalación, manual de usuario, documentación de la API para el anexo (a partir de [`docs/api/contrato-v1.md`](../api/contrato-v1.md)), mapa de pantallas, despliegue, resultados de pruebas, validación con usuarios.

## Relación con la estructura provisional de la memoria

| Apartado de la memoria (provisional ⚠️) | Fuente en el repositorio |
|------------------------------------------|--------------------------|
| 1. Introducción y objetivos | `CarCare/01_plan/plan-general.md` · *pendiente de redactar* |
| 2. Análisis del problema y competencia | `CarCare/06_investigacion/` · *pendiente: aún no hay investigación ni entrevistas* |
| 3. Requisitos funcionales y no funcionales | **[01‑requisitos.md](01-requisitos.md)** |
| 4. Casos de uso e historias | **[02‑casos-de-uso.md](02-casos-de-uso.md)** + `CarCare/02_backlog/backlog-mvp.md` |
| 5. Diseño: arquitectura, E‑R, UML, interfaz | **[03](03-modelo-de-datos.md)**, **[04](04-arquitectura.md)**, **[05](05-diagramas-secuencia.md)**, **[06](06-diagrama-clases.md)** + ADR de [`docs/arquitectura/`](../arquitectura/) · *diseño de interfaz pendiente* |
| 6. Implementación | Repositorio (`backend/`, `frontend/`) · *en construcción* |
| 7. Pruebas con resultados reales | **[07‑plan-de-pruebas.md](07-plan-de-pruebas.md)** (plan) + informes de `docs/equipo/informes/` (resultados) |
| 8. Despliegue | *Pendiente (oleada 4)* |
| 9. Manual de instalación | *Pendiente (oleada 4)* |
| 10. Manual de usuario | *Pendiente (oleada 4)* |
| 11. Validación con usuarios | `CarCare/06_investigacion/` · *pendiente* |
| 12. Conclusiones y trabajo futuro | `CarCare/04_ideas/` · *pendiente* |
| 13. Bibliografía | *Pendiente de compilar* |
| 14. Anexos (API, glosario, capturas) | [`docs/api/contrato-v1.md`](../api/contrato-v1.md), **[08‑glosario.md](08-glosario.md)** |

## Convenciones

- **Idioma:** español académico, sin relleno; cada decisión explica su porqué y enlaza su ADR.
- **Identificadores:** `RF-nn`, `RNF-nn`, `CU-nn` y casos de prueba `PU-`, `PF-`, `PA-`, `PE-`, `PR-`, con guion ASCII para poder buscarlos. Las historias del backlog se citan como `E3-6`.
- **Diagramas:** Mermaid dentro de Markdown (`erDiagram`, `classDiagram`, `sequenceDiagram`, `stateDiagram-v2`, `flowchart`), para poder regenerarlos y versionarlos. Se visualizan en GitHub y en VS Code (con la extensión de vista previa de Mermaid). Todos los bloques se han comprobado sintácticamente con `mermaid.parse` (Mermaid 11.4.1).
- **Estado de verificación:** cada documento indica qué está comprobado contra el código o las migraciones (✔) y qué es diseño a partir del contrato (⏳). Lo pendiente se marca como pendiente.
- **Nada inventado:** no se anotan resultados de pruebas, métricas ni conclusiones de entrevistas que no procedan de un informe real de `docs/equipo/informes/` o de `CarCare/06_investigacion/`.
