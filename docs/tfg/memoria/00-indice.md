# CarCare · Memoria del Trabajo de Fin de Grado

**Ciclo formativo de grado superior en Desarrollo de Aplicaciones Web (DAW) · Ilerna**

> ⚠️ **Depende de Ilerna.** Portada, datos del alumno y del tutor, convocatoria, formato (fuente, márgenes, extensión) y orden obligatorio de apartados quedan pendientes de la guía oficial del módulo de Proyecto (decisión D1, sin respuesta a 24/10/2026). La plantilla Word disponible es de la URJC y no se usa. La estructura de este borrador es la provisional de [`CarCare/07_memoria-tfg/estructura-memoria.md`](../../../CarCare/07_memoria-tfg/estructura-memoria.md), con un capítulo añadido de planificación y metodología.

| Campo | Valor |
|-------|-------|
| Título provisional | CarCare: plataforma web para gestionar la vida de un vehículo, para particulares y talleres, con interfaz 3D |
| Autor | Alberto *(⚠️ nombre completo, DNI y grupo según la guía de Ilerna)* |
| Tutor | *(⚠️ pendiente)* |
| Convocatoria | *(⚠️ pendiente)* |
| Versión de este documento | Primer borrador, 24/10/2026 |
| Repositorio | Monorepo Git, rama `develop` (remoto en GitHub en preparación: tarea 0 de la cola del equipo) |

## Índice

| # | Capítulo | Archivo | Estado del borrador (24/10/2026) |
|---|----------|---------|----------------------------------|
| — | Resumen y palabras clave | este archivo, más abajo | Borrador |
| 1 | Introducción y objetivos | [01-introduccion.md](01-introduccion.md) | Borrador completo |
| 2 | Análisis del problema y de la competencia | [02-analisis.md](02-analisis.md) | Borrador completo |
| 3 | Planificación y metodología | [03-planificacion-metodologia.md](03-planificacion-metodologia.md) | Borrador completo |
| 4 | Requisitos funcionales y no funcionales | [04-requisitos.md](04-requisitos.md) | Borrador completo |
| 5 | Casos de uso | [05-casos-de-uso.md](05-casos-de-uso.md) | Borrador completo |
| 6 | Diseño | [06-diseno.md](06-diseno.md) | Borrador completo |
| 7 | Implementación | [07-implementacion.md](07-implementacion.md) | Borrador completo |
| 8 | Pruebas | [08-pruebas.md](08-pruebas.md) | Esqueleto con las cifras reales que existen |
| 9 | Despliegue | [09-despliegue.md](09-despliegue.md) | Esqueleto (D14 pendiente) |
| 10 | Manual de instalación | [10-manual-instalacion.md](10-manual-instalacion.md) | Adelantado a partir de `README.md` e `iniciar-carcare.bat` |
| 11 | Manual de usuario | [11-manual-usuario.md](11-manual-usuario.md) | Esqueleto (espera a la simplificación de la interfaz) |
| 12 | Validación con usuarios | [12-validacion-usuarios.md](12-validacion-usuarios.md) | Esqueleto (no se ha hecho ninguna sesión) |
| 13 | Conclusiones y trabajo futuro | [13-conclusiones.md](13-conclusiones.md) | Borrador completo (provisional hasta tener pruebas y validación) |
| 14 | Bibliografía | [14-bibliografia.md](14-bibliografia.md) | Borrador completo |
| 15 | Anexos | [15-anexos.md](15-anexos.md) | Esqueleto |

**Correspondencia con la estructura provisional.** Los capítulos 1, 2, 4‑13 y 15 corresponden, en este orden, a los apartados 1‑14 de `estructura-memoria.md` (el apartado 4 "Casos de uso e historias" es aquí el capítulo 5). El capítulo 3, *Planificación y metodología*, es nuevo: lo pide el encargo de la memoria y es habitual en los proyectos de DAW. Si la guía de Ilerna fija otro orden, los capítulos se reordenan sin reescribirlos.

## Resumen

CarCare es una aplicación web para gestionar la vida de un vehículo. Tiene dos modos sobre la misma base de datos. En el modo **particular**, el propietario registra kilometraje, repostajes, gastos, intervenciones, recordatorios y documentos, y consulta su coste real. En el modo **taller**, un equipo con roles gestiona clientes, flota, órdenes de trabajo en un tablero kanban y la ocupación de los elevadores. La interfaz incluye un vehículo en 3D generado por código y un taller en 3D, siempre con una alternativa en 2D y en HTML accesible.

La solución separa una API REST en Laravel 12 (PHP 8.2, MariaDB) de una aplicación de página única en React 19 y TypeScript, unidas por un contrato de API escrito antes que el código. La autorización se resuelve en el servidor a través del espacio de trabajo del recurso y del rol del usuario. A 23/10/2026 la API tiene 68 rutas y una batería de 462 pruebas automáticas con 6.959 aserciones en verde, ejecutada sobre SQLite y sobre MariaDB. Quedan pendientes las pruebas extremo a extremo, la auditoría de accesibilidad y de seguridad, la integración continua y la validación con usuarios reales; la memoria los marca como pendientes y no adelanta resultados.

El desarrollo se ha apoyado en un asistente de programación con inteligencia artificial (Claude Code), organizado en agentes por área y dirigido por el autor. El capítulo 3 describe cómo.

**Palabras clave:** aplicación web, API REST, Laravel, React, TypeScript, multiinquilino, control de acceso basado en roles, WebGL, three.js, accesibilidad.

> [PENDIENTE: tarea 10 — revisar el resumen con los resultados finales de pruebas y validación. ⚠️ Depende de Ilerna: si se exige resumen en inglés (*abstract*) y su extensión.]

## Convenciones de este documento

- **Fuentes.** Todo lo que se afirma del sistema procede del código del repositorio (se cita la ruta del archivo) o de un informe fechado de `docs/equipo/informes/`. Las cifras de pruebas solo se citan si hay una ejecución documentada.
- **Huecos.** Lo que depende de una tarea posterior se marca así: `> [PENDIENTE: tarea N — qué falta]`, con el número de la cola de [`docs/equipo/AUTOPILOTO.md`](../../equipo/AUTOPILOTO.md).
- **Normativa.** `⚠️ Depende de Ilerna` marca lo que no se puede cerrar sin la guía oficial.
- **Identificadores.** Requisitos `RF-nn` y `RNF-nn`, casos de uso `CU-nn`, historias del backlog `E3-6`, decisiones `D1…D17`, decisiones de arquitectura `ADR-0001…`.
- **Diagramas.** En Mermaid dentro del Markdown, para poder regenerarlos desde el código. Su sintaxis se ha comprobado con `mermaid.parse` (Mermaid 11.4.1). > [PENDIENTE: tarea 10 — renderizarlos a imagen para la versión en Word o PDF.]
- **Fechas.** Formato `dd/mm/aaaa`. Todas las fechas del proyecto son de 2026.
