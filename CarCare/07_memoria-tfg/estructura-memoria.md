# Memoria del TFG · estructura y seguimiento

⚠️ *Depende de Ilerna*: estructura provisional hasta tener la guía oficial del módulo de Proyecto. La plantilla Word disponible es de la URJC y solo aporta portada y estilos; no se usará salvo que lo confirmes.

## Requisitos oficiales (rellenar con la guía de Ilerna)

| Requisito | Valor | Fuente |
|-----------|-------|--------|
| Extensión mínima / máxima | | |
| Apartados obligatorios | | |
| Formato (fuente, márgenes, portada) | | |
| Tecnologías exigidas o prohibidas | | |
| Fecha de entrega | | |
| Fecha y formato de defensa | | |
| Rúbrica de evaluación | | |

## Estructura provisional

*Seguimiento actualizado el 26/10/2026 por `documentador-tfg`. Los archivos están en `docs/tfg/memoria/` y su numeración (00‑15) incluye un capítulo 3 de planificación que esta tabla no tiene.*

| # | Apartado | Fuente en esta carpeta | Estado |
|---|----------|------------------------|--------|
| 1 | Introducción y objetivos | `01_plan/plan-general.md` | Borrador completo (`docs/tfg/memoria/01`) |
| 2 | Análisis del problema y competencia | `06_investigacion/` | Borrador completo (`02`) |
| 3 | Requisitos funcionales y no funcionales | `02_backlog/` | Borrador completo (`04`; el `03` es planificación y metodología) |
| 4 | Casos de uso e historias | `02_backlog/` | Borrador completo (`05`) |
| 5 | Diseño: arquitectura, E‑R, UML, interfaz | plan inicial §2‑§4, `03_decisiones/` | Borrador completo (`06`); faltan capturas |
| 6 | Implementación | repositorio | Borrador completo (`07`) |
| 7 | Pruebas con resultados reales | CI y notas de `05_sesiones/` | Backend con resultados reales (`08`); E2E, axe, seguridad y CI pendientes |
| 8 | Despliegue | | Borrador completo (`09`); opción de la defensa pendiente de D14 |
| 9 | Manual de instalación | | Borrador completo (`10`) |
| 10 | Manual de usuario | | Esqueleto por tareas (`11`); pasos y 30 capturas tras la simplificación |
| 11 | Validación con usuarios | `06_investigacion/entrevista-*.md` | Solo el plan (`12`); ninguna sesión hecha |
| 12 | Conclusiones y trabajo futuro | `04_ideas/` | Borrador completo (`13`), provisional |
| 13 | Bibliografía | | Borrador completo (`14`) |
| 14 | Anexos (API, capturas) | | Borrador (`15`): API, ADR, glosario; faltan capturas |

## Diagramas necesarios

- [x] Diagrama entidad‑relación (Figura 6.3)
- [x] Diagrama de casos de uso (Figura 5.1)
- [x] Diagrama de clases (Figuras 6.4 y 6.5)
- [x] Diagramas de secuencia (login, crear intervención con gasto, entregar orden, recuperar contraseña: Figuras 6.6‑6.8 y 6.10)
- [x] Arquitectura cliente/servidor (Figuras 6.1 y 9.1)
- [x] Mapa de pantallas (Figura 6.12; regenerar tras la simplificación)
