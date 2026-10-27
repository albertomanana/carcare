# CarCare · Memoria del Trabajo de Fin de Grado

**Ciclo formativo de grado superior en Desarrollo de Aplicaciones Web (DAW) · Ilerna**

> ⚠️ **Depende de Ilerna.** Portada, datos del alumno y del tutor, convocatoria, formato (fuente, márgenes, extensión) y orden obligatorio de apartados quedan pendientes de la guía oficial del módulo de Proyecto (decisión D1, sin respuesta a 24/10/2026). La plantilla Word disponible es de la URJC y no se usa. La estructura de este borrador es la provisional de [`CarCare/07_memoria-tfg/estructura-memoria.md`](../../../CarCare/07_memoria-tfg/estructura-memoria.md), con un capítulo añadido de planificación y metodología.

| Campo | Valor |
|-------|-------|
| Título provisional | CarCare: plataforma web para gestionar la vida de un vehículo, para particulares y talleres, con interfaz 3D |
| Autor | Alberto *(⚠️ nombre completo, DNI y grupo según la guía de Ilerna)* |
| Tutor | *(⚠️ pendiente)* |
| Convocatoria | *(⚠️ pendiente)* |
| Versión de este documento | Primer borrador completo, 26/10/2026 |
| Repositorio | Monorepo Git en un repositorio privado de GitHub (`albertomanana/carcare`), ramas `main` y `develop` (capítulo 9, §9.2) |

## Índice

| # | Capítulo | Archivo | Estado del borrador (26/10/2026) |
|---|----------|---------|----------------------------------|
| — | Resumen y palabras clave | este archivo, más abajo | Borrador |
| 1 | Introducción y objetivos | [01-introduccion.md](01-introduccion.md) | Borrador completo |
| 2 | Análisis del problema y de la competencia | [02-analisis.md](02-analisis.md) | Borrador completo |
| 3 | Planificación y metodología | [03-planificacion-metodologia.md](03-planificacion-metodologia.md) | Borrador completo |
| 4 | Requisitos funcionales y no funcionales | [04-requisitos.md](04-requisitos.md) | Borrador completo |
| 5 | Casos de uso | [05-casos-de-uso.md](05-casos-de-uso.md) | Borrador completo |
| 6 | Diseño | [06-diseno.md](06-diseno.md) | Borrador completo |
| 7 | Implementación | [07-implementacion.md](07-implementacion.md) | Borrador completo |
| 8 | Pruebas | [08-pruebas.md](08-pruebas.md) | Backend con resultados reales (26/10); E2E, accesibilidad, seguridad y CI pendientes |
| 9 | Despliegue | [09-despliegue.md](09-despliegue.md) | Borrador completo; la opción de la defensa depende de D14 |
| 10 | Manual de instalación | [10-manual-instalacion.md](10-manual-instalacion.md) | Borrador completo, a partir de `README.md` e `iniciar-carcare.bat` |
| 11 | Manual de usuario | [11-manual-usuario.md](11-manual-usuario.md) | Esqueleto por tareas, con 30 capturas previstas; espera a la simplificación de la interfaz |
| 12 | Validación con usuarios | [12-validacion-usuarios.md](12-validacion-usuarios.md) | Solo el plan; no se ha hecho ninguna sesión |
| 13 | Conclusiones y trabajo futuro | [13-conclusiones.md](13-conclusiones.md) | Borrador completo (provisional hasta tener pruebas y validación) |
| 14 | Bibliografía | [14-bibliografia.md](14-bibliografia.md) | Borrador completo |
| 15 | Anexos | [15-anexos.md](15-anexos.md) | Índice de la API (72 rutas), ADR, glosario, decisiones e informes; faltan las capturas |

**Correspondencia con la estructura provisional.** Los capítulos 1, 2, 4‑13 y 15 corresponden, en este orden, a los apartados 1‑14 de `estructura-memoria.md` (el apartado 4 "Casos de uso e historias" es aquí el capítulo 5). El capítulo 3, *Planificación y metodología*, es nuevo: lo pide el encargo de la memoria y es habitual en los proyectos de DAW. Si la guía de Ilerna fija otro orden, los capítulos se reordenan sin reescribirlos.

<!-- indice-figuras -->
## Índice de figuras

- Figura 3.1. Cronología real del proyecto en un diagrama de Gantt. — [03-planificacion-metodologia.md](03-planificacion-metodologia.md)
- Figura 5.1. Diagrama de casos de uso. — [05-casos-de-uso.md](05-casos-de-uso.md)
- Figura 6.1. Arquitectura general: SPA, API y base de datos. — [06-diseno.md](06-diseno.md)
- Figura 6.2. Resolución de una petición: sesión, espacio del recurso y capacidad. — [06-diseno.md](06-diseno.md)
- Figura 6.3. Diagrama entidad-relación. — [06-diseno.md](06-diseno.md)
- Figura 6.4. Diagrama de clases del modelo de dominio. — [06-diseno.md](06-diseno.md)
- Figura 6.5. Diagrama de clases de servicios, policies y utilidades. — [06-diseno.md](06-diseno.md)
- Figura 6.6. Secuencia del inicio de sesión con Sanctum en modo SPA. — [06-diseno.md](06-diseno.md)
- Figura 6.7. Secuencia del registro de una intervención con coste (gasto vinculado). — [06-diseno.md](06-diseno.md)
- Figura 6.8. Secuencia de la entrega de una orden de trabajo. — [06-diseno.md](06-diseno.md)
- Figura 6.9. Ciclo de vida de una orden de trabajo. — [06-diseno.md](06-diseno.md)
- Figura 6.10. Secuencia de la recuperación de la contraseña. — [06-diseno.md](06-diseno.md)
- Figura 6.11. Ciclo de vida de una solicitud de reparación (diseño de ADR‑0007). — [06-diseno.md](06-diseno.md)
- Figura 6.12. Mapa de pantallas. — [06-diseno.md](06-diseno.md)
- Figura 6.13. Módulo 3D: interfaz pública y componentes. — [06-diseno.md](06-diseno.md)
- Figura 9.1. Despliegue en local: el navegador solo habla con Vite, que reenvía a la API. — [09-despliegue.md](09-despliegue.md)

## Índice de tablas

- Tabla 1.1. Objetivos específicos, criterio de cumplimiento y estado. — [01-introduccion.md](01-introduccion.md)
- Tabla 1.2. Funciones fuera del alcance y motivo. — [01-introduccion.md](01-introduccion.md)
- Tabla 2.1. Perfiles de usuario y su rol en CarCare. — [02-analisis.md](02-analisis.md)
- Tabla 2.2. Hipótesis de producto pendientes de validar. — [02-analisis.md](02-analisis.md)
- Tabla 2.3. Aplicaciones para particulares. — [02-analisis.md](02-analisis.md)
- Tabla 2.4. Software de gestión de talleres. — [02-analisis.md](02-analisis.md)
- Tabla 2.5. Viabilidad técnica. — [02-analisis.md](02-analisis.md)
- Tabla 3.1. Prácticas del enfoque de trabajo. — [03-planificacion-metodologia.md](03-planificacion-metodologia.md)
- Tabla 3.2. Agentes del equipo, su rol y su zona. — [03-planificacion-metodologia.md](03-planificacion-metodologia.md)
- Tabla 3.3. Decisiones tomadas por el autor. — [03-planificacion-metodologia.md](03-planificacion-metodologia.md)
- Tabla 3.4. Cronología real del proyecto. — [03-planificacion-metodologia.md](03-planificacion-metodologia.md)
- Tabla 3.5. Plan hasta el 31/10/2026. — [03-planificacion-metodologia.md](03-planificacion-metodologia.md)
- Tabla 3.6. Riesgos principales y mitigación aplicada. — [03-planificacion-metodologia.md](03-planificacion-metodologia.md)
- Tabla 4.1. Columnas de las tablas de requisitos. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.2. Requisitos funcionales: sistema y cuenta. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.3. Requisitos funcionales: espacios de trabajo y equipo. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.4. Requisitos funcionales: garaje y kilometraje. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.5. Requisitos funcionales: intervenciones, gastos y analítica. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.6. Requisitos funcionales: recordatorios y zonas. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.7. Requisitos funcionales: experiencia 3D. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.8. Requisitos funcionales: documentos, seguimiento y actividad. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.9. Requisitos funcionales: taller (clientes, órdenes y elevadores). — [04-requisitos.md](04-requisitos.md)
- Tabla 4.10. Cobertura de los requisitos funcionales por bloque. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.11. Requisitos no funcionales. — [04-requisitos.md](04-requisitos.md)
- Tabla 4.12. Cambios respecto a la especificación del 21/10/2026. — [04-requisitos.md](04-requisitos.md)
- Tabla 5.1. Actores del sistema. — [05-casos-de-uso.md](05-casos-de-uso.md)
- Tabla 5.2. Catálogo de casos de uso. — [05-casos-de-uso.md](05-casos-de-uso.md)
- Tabla 5.3. Correcciones respecto a la versión del 21/10/2026. — [05-casos-de-uso.md](05-casos-de-uso.md)
- Tabla 6.1. Capas del backend y sus responsabilidades. — [06-diseno.md](06-diseno.md)
- Tabla 6.2. Decisiones de arquitectura (ADR). — [06-diseno.md](06-diseno.md)
- Tabla 6.3. Capacidades por rol. — [06-diseno.md](06-diseno.md)
- Tabla 6.4. Cardinalidades y reglas de borrado. — [06-diseno.md](06-diseno.md)
- Tabla 6.5. Servicios del backend y requisitos que implementan. — [06-diseno.md](06-diseno.md)
- Tabla 6.6. Pantallas con 3D y su alternativa. — [06-diseno.md](06-diseno.md)
- Tabla 6.7. Cambios respecto al diseño del 21/10/2026. — [06-diseno.md](06-diseno.md)
- Tabla 7.1. Versiones del entorno de desarrollo. — [07-implementacion.md](07-implementacion.md)
- Tabla 7.2. Tamaño del código por área. — [07-implementacion.md](07-implementacion.md)
- Tabla 7.3. Trabajo en construcción a 26/10/2026. — [07-implementacion.md](07-implementacion.md)
- Tabla 8.1. Niveles de prueba y su estado. — [08-pruebas.md](08-pruebas.md)
- Tabla 8.2. Ejecuciones documentadas de la batería del backend. — [08-pruebas.md](08-pruebas.md)
- Tabla 8.3. Casos de prueba del backend por archivo. — [08-pruebas.md](08-pruebas.md)
- Tabla 8.4. Casos críticos del plan de pruebas y su resultado. — [08-pruebas.md](08-pruebas.md)
- Tabla 8.5. Ejecuciones documentadas del frontend. — [08-pruebas.md](08-pruebas.md)
- Tabla 8.6. Pruebas del frontend por archivo. — [08-pruebas.md](08-pruebas.md)
- Tabla 8.7. Medición inicial del 3D (23/10/2026). — [08-pruebas.md](08-pruebas.md)
- Tabla 8.8. Requisitos funcionales sin prueba automática. — [08-pruebas.md](08-pruebas.md)
- Tabla 8.9. Pruebas pendientes y criterio de aceptación. — [08-pruebas.md](08-pruebas.md)
- Tabla 9.1. Procesos de la ejecución en local. — [09-despliegue.md](09-despliegue.md)
- Tabla 9.2. Ramas permanentes del repositorio. — [09-despliegue.md](09-despliegue.md)
- Tabla 9.3. Hitos de publicación en `main`. — [09-despliegue.md](09-despliegue.md)
- Tabla 9.4. Opciones de despliegue para la defensa (D14). — [09-despliegue.md](09-despliegue.md)
- Tabla 9.5. Cambios necesarios para un despliegue en servidor, según la configuración actual. — [09-despliegue.md](09-despliegue.md)
- Tabla 10.1. Requisitos de software. — [10-manual-instalacion.md](10-manual-instalacion.md)
- Tabla 10.2. Comprobaciones tras el arranque. — [10-manual-instalacion.md](10-manual-instalacion.md)
- Tabla 10.3. Cuentas de demostración. — [10-manual-instalacion.md](10-manual-instalacion.md)
- Tabla 10.4. Problemas frecuentes. — [10-manual-instalacion.md](10-manual-instalacion.md)
- Tabla 11.1. Tareas del modo particular. — [11-manual-usuario.md](11-manual-usuario.md)
- Tabla 11.2. Tareas del modo taller y roles que pueden hacerlas. — [11-manual-usuario.md](11-manual-usuario.md)
- Tabla 11.3. Lista de capturas del manual de usuario. — [11-manual-usuario.md](11-manual-usuario.md)
- Tabla 12.1. Preguntas que debe responder la validación. — [12-validacion-usuarios.md](12-validacion-usuarios.md)
- Tabla 12.2. Perfiles de participantes previstos. — [12-validacion-usuarios.md](12-validacion-usuarios.md)
- Tabla 12.3. Duración prevista de cada sesión. — [12-validacion-usuarios.md](12-validacion-usuarios.md)
- Tabla 12.4. Métricas de la validación. — [12-validacion-usuarios.md](12-validacion-usuarios.md)
- Tabla 12.5. Resultados por tarea (vacía hasta que haya sesiones). — [12-validacion-usuarios.md](12-validacion-usuarios.md)
- Tabla 12.6. SUS y hallazgo principal por participante (vacía hasta que haya sesiones). — [12-validacion-usuarios.md](12-validacion-usuarios.md)
- Tabla 12.7. Aplicación de los umbrales de decisión (vacía hasta que haya sesiones). — [12-validacion-usuarios.md](12-validacion-usuarios.md)
- Tabla 13.1. Cumplimiento de los objetivos específicos a 26/10/2026. — [13-conclusiones.md](13-conclusiones.md)
- Tabla 13.2. Limitaciones del sistema. — [13-conclusiones.md](13-conclusiones.md)
- Tabla 14.1. Documentación técnica consultada. — [14-bibliografia.md](14-bibliografia.md)
- Tabla 14.2. Documentación interna del proyecto. — [14-bibliografia.md](14-bibliografia.md)
- Tabla 15.1. API: salud y autenticación. — [15-anexos.md](15-anexos.md)
- Tabla 15.2. API: cuenta del usuario. — [15-anexos.md](15-anexos.md)
- Tabla 15.3. API: espacios de trabajo, miembros y vistas del espacio. — [15-anexos.md](15-anexos.md)
- Tabla 15.4. API: vehículos, kilometraje, intervenciones, gastos, recordatorios y documentos. — [15-anexos.md](15-anexos.md)
- Tabla 15.5. API: clientes y órdenes de trabajo del taller. — [15-anexos.md](15-anexos.md)
- Tabla 15.6. Decisiones de arquitectura del proyecto. — [15-anexos.md](15-anexos.md)
- Tabla 15.7. Glosario. — [15-anexos.md](15-anexos.md)
- Tabla 15.8. Decisiones del producto citadas en la memoria. — [15-anexos.md](15-anexos.md)
- Tabla 15.9. Informes del equipo citados. — [15-anexos.md](15-anexos.md)
<!-- fin-indice-tablas -->

## Resumen

CarCare es una aplicación web para gestionar la vida de un vehículo. Tiene dos modos sobre la misma base de datos. En el modo **particular**, el propietario registra kilometraje, repostajes, gastos, intervenciones, recordatorios y documentos, y consulta su coste real. En el modo **taller**, un equipo con roles gestiona clientes, flota, órdenes de trabajo en un tablero kanban y la ocupación de los elevadores. La interfaz incluye un vehículo en 3D generado por código y un taller en 3D, siempre con una alternativa en 2D y en HTML accesible.

La solución separa una API REST en Laravel 12 (PHP 8.2, MariaDB) de una aplicación de página única en React 19 y TypeScript, unidas por un contrato de API escrito antes que el código. La autorización se resuelve en el servidor a través del espacio de trabajo del recurso y del rol del usuario. A 26/10/2026 la API tiene 72 rutas y una batería de 511 pruebas automáticas con 7.864 aserciones en verde sobre SQLite; una versión anterior de la batería, con 462 pruebas, pasó también sobre MariaDB el 23/10. Quedan pendientes las pruebas extremo a extremo, la auditoría de accesibilidad y de seguridad, la integración continua y la validación con usuarios reales; la memoria los marca como pendientes y no adelanta resultados.

El desarrollo se ha apoyado en un asistente de programación con inteligencia artificial (Claude Code), organizado en agentes por área y dirigido por el autor. El capítulo 3 describe cómo.

**Palabras clave:** aplicación web, API REST, Laravel, React, TypeScript, multiinquilino, control de acceso basado en roles, WebGL, three.js, accesibilidad.

> [PENDIENTE: tarea 10 — revisar el resumen con los resultados finales de pruebas y validación. ⚠️ Depende de Ilerna: si se exige resumen en inglés (*abstract*) y su extensión.]

## Convenciones de este documento

- **Fuentes.** Todo lo que se afirma del sistema procede del código del repositorio (se cita la ruta del archivo) o de un informe fechado de `docs/equipo/informes/`. Las cifras de pruebas solo se citan si hay una ejecución documentada.
- **Huecos.** Lo que depende de una tarea posterior se marca así: `> [PENDIENTE: tarea N — qué falta]`, con el número de la cola de [`docs/equipo/AUTOPILOTO.md`](../../equipo/AUTOPILOTO.md).
- **Normativa.** `⚠️ Depende de Ilerna` marca lo que no se puede cerrar sin la guía oficial.
- **Identificadores.** Requisitos `RF-nn` y `RNF-nn`, casos de uso `CU-nn`, historias del backlog `E3-6`, decisiones `D1…D17`, decisiones de arquitectura `ADR-0001…`.
- **Diagramas.** En Mermaid dentro del Markdown, para poder regenerarlos desde el código. La sintaxis de los 16 diagramas se comprobó con `mermaid.parse` (Mermaid 11.4.1) el 26/10/2026.
- **Figuras y tablas.** Se numeran por capítulo: el pie de cada tabla va encima (`Tabla 4.2.`) y el de cada figura, debajo (`Figura 6.3.`). El script `docs/tfg/herramientas/numerar_figuras_tablas.py` renumera los pies y regenera los índices de figuras y de tablas del final de este archivo; el índice de la API del anexo A se regenera con `docs/tfg/herramientas/anexo_api.py`. > [PENDIENTE: tarea 10 — renderizarlos a imagen para la versión en Word o PDF.]
- **Fechas.** Formato `dd/mm/aaaa`. Todas las fechas del proyecto son de 2026.
