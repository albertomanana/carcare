# Piloto automático de CarCare

El piloto automático es una sesión de Claude Code **sin ventana de chat** que se lanza sola al iniciar sesión en el PC y luego **cada hora**. Si el límite de uso está agotado, no hace nada y lo vuelve a intentar a la hora siguiente; en cuanto el límite se resetea, retoma el trabajo desde esta cola.

## Para Alberto: control rápido

| Quiero… | Haz esto |
|---------|----------|
| Ver qué ha hecho | Sección **Últimas ejecuciones** (abajo), `CarCare/05_sesiones/` y `docs/equipo/informes/`. Registro técnico completo: `scripts/autopiloto/logs/` |
| Pausarlo (p. ej. mientras trabajo yo con Claude) | Doble clic en `scripts/autopiloto/pausar.cmd` (crea el archivo `scripts/autopiloto/PAUSA`) |
| Reanudarlo | Doble clic en `scripts/autopiloto/reanudar.cmd` |
| Lanzar una ejecución ya | Doble clic en `scripts/autopiloto/ejecutar-ahora.cmd` |
| Quitarlo del arranque de Windows | `scripts/autopiloto/desinstalar.cmd` |
| Cambiar lo que hace | Edita la **Cola** de este documento: el piloto siempre coge la primera tarea `Pendiente` cuyas dependencias estén `Hecho` |

## Reglas para la sesión automática (las lee Claude en cada ejecución)

1. Lee `CLAUDE.md`, `docs/equipo/TABLERO.md`, los informes más recientes de `docs/equipo/informes/` y este documento completo.
2. Si otra sesión está trabajando (la fila "Sesión interactiva" del tablero dice `En curso` con fecha de hoy y menos de 2 horas), **no toques sus archivos**: elige una tarea de la cola que no se solape o termina sin hacer nada.
3. Coge la **primera tarea `Pendiente`** de la cola cuyas dependencias estén `Hecho`. Márcala `En curso (autopiloto, AAAA-MM-DD HH:MM)`.
4. Encárgasela al agente indicado (los de `.claude/agents/`) con un encargo concreto: objetivo, archivos, criterios de aceptación y verificación. Máximo **2 agentes en paralelo** y solo si sus zonas no se solapan. **Espera a que terminen** antes de acabar la sesión. Si un agente necesita la app arrancada para probar, dale **su propia instancia** (API en 8050‑8090 y Vite en 5183‑5189, ver "Instancia aislada" en `CLAUDE.md`): :8000 y :5173 son de Alberto y el servidor de PHP atiende una petición a la vez.
5. Verifica tú el resultado (tests, build, prueba de humo o capturas). Marca la tarea `Hecho` con enlace al informe, o `Bloqueado` con el motivo exacto.
6. Si queda margen, sigue con la siguiente tarea. Antes de terminar, escribe la nota de sesión en `CarCare/05_sesiones/AAAA-MM-DD-autopiloto-HHMM.md` y añade una fila en **Últimas ejecuciones** (fecha, tareas, resultado, qué necesita a Alberto).
7. Si una tarea se corta a medias (por ejemplo, por el límite de uso), déjala `En curso` con una nota de dónde se quedó: la siguiente ejecución la retoma inspeccionando el disco, sin rehacer. Esto vale también para las tareas `En curso (sesión interactiva, …)` cuando esa sesión lleva más de 2 horas sin actualizar su fila del tablero: se cerró sin terminarlas. Para retomarlas, parte del informe a medio escribir del agente y de los archivos que haya en disco.

8. **Git (autorizado por Alberto el 23/10/2026):** al terminar, commits en la rama `develop` siguiendo [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (un commit por área tocada, Conventional Commits en español) y `git push origin develop`. Antes de cada commit, comprueba con `git status` que no se cuela ningún `.env` ni archivos de `storage/`. Si la rama actual no es `develop`, no hagas commit y anótalo.

**Prohibido sin autorización escrita de Alberto en este documento:** commit o push a `main`, `push --force`, crear o borrar ramas, borrar datos o ejecutar `migrate:fresh` sin volver a sembrar, tocar `Car_Care_Documentacion/`, instalar software global, contratar o llamar a servicios externos de pago, publicar nada fuera del PC y tomar decisiones reservadas a Alberto (las marcadas `Decide Alberto`). Ante la duda, se anota la pregunta en "Últimas ejecuciones" y se pasa a otra tarea.

## Plan hasta el 31/10/2026

Alberto (24/10): "me gustaría tener ya una buena memoria y una defensa decente antes de que acabe este mes". No hay fecha oficial todavía. Orden de prioridad cuando el límite de uso no da para todo: **memoria > app completa y simple > calidad (E2E, seguridad, accesibilidad) > defensa > lo demás**.

| Día | Objetivo |
|-----|----------|
| Sáb 24 | Analítica (17, 22, 23), datos demo (19), contratos (27, 28, 29), "Mis órdenes" (25), memoria: borrador de los capítulos 1‑5 (10a) |
| Dom 25 | Simplificación de las pantallas (16, paso 2) y 3D solo donde aporta; recuperar la contraseña (28); memoria: diseño e implementación |
| Lun 26 | E16 solicitudes a talleres: backend (33) y pantallas (34, 35); dirección visual solo si Alberto la elige (18); resumen imprimible (24); RGPD (29); seguridad (7) y CI (11) |
| Mar 27 | Integración completa con las 4 cuentas (5), E2E y axe (6) |
| Mié 28 | Correcciones (9); capítulo de pruebas con resultados reales, manuales y anexos (10) |
| Jue 29 | Memoria revisada y exportada; defensa: diapositivas, guion de la demo y preguntas (31) |
| Vie 30 | Ensayo de la defensa, vídeo de respaldo y margen |

## Cola de tareas

Estados: `Pendiente` · `En curso` · `Hecho` · `Bloqueado`. Prioridad de arriba abajo.

| # | Tarea | Agente | Depende de | Estado |
|---|-------|--------|------------|--------|
| 0 | **Publicar en GitHub** (pedido por Alberto el 23/10): si `.tools/gh/bin/gh.exe auth status` dice que hay sesión y `git remote` está vacío, ejecutar `bash scripts/github/publicar-repo.sh` (crea el repo privado, `main` mínima y `develop` con commits por área). Si no hay sesión, dejarla `Pendiente` y anotar en "Últimas ejecuciones": "Alberto: ejecuta scripts/github/conectar-github.cmd" | sesión principal | Sesión de GitHub iniciada por Alberto | Hecho (24/10 14:10, sesión interactiva): repositorio **privado** https://github.com/albertomanana/carcare, `main` por defecto y `develop` con todos los commits. Desde ahora el piloto hace `git push origin develop` al terminar |
| 1 | Oleada 1c/1d: pantallas del modo particular | frontend-react | — | Hecho (23/10) salvo `AnalyticsPage` (pasa a la tarea 17). Commit 779dc5c. Sin informe final (cortado por límite): se incluye en la tarea 16 |
| 2 | Oleada 1c/1d: modo taller completo | frontend-react | — | Hecho (23/10). Commit 779dc5c. Sin informe final (cortado por límite): se incluye en la tarea 16 |
| 3 | Oleada 1c: cerrar tests de la API e informe | backend-laravel | — | Hecho (23/10): 462 tests / 6959 aserciones en verde, verificado por la sesión principal. [Informe](informes/2026-10-23-backend-laravel-api-v1.md) |
| 4 | Oleada 1c/1d: portada 3D, marcadores de zona, miniaturas | experto-3d | — | Hecho (23/10). Commit 1921a16. Sin informe final: se incluye en la tarea 16 |
| 16 | **Simplificar mucho la interfaz** (pedido por Alberto el 23/10: "la veo sobrecargada, quiero que sea más simple y que cargue más rápido"). Paso 1: auditoría y plan por pantalla de `disenador-ux` (en curso en la sesión interactiva). Paso 2: aplicar el plan, repartido entre frontend-react (particular), frontend-react (taller) y experto-3d según la lista de tareas del informe de UX. Cada agente cierra con su informe incluyendo lo de las oleadas 1c/1d | disenador-ux → frontend-react ×2, experto-3d | — | En curso (sesión interactiva, 23/10 22:50): paso 1 |
| 17 | `AnalyticsPage` (única pantalla que sigue vacía), simple desde el principio | frontend-react | — (Alberto pidió el 23/10 completar ya los huecos) | En curso (sesión interactiva, 23/10 23:20) |
| 19 | **Datos demo completos** (ninguna pantalla vacía con las cuentas demo; seeder que se puede ejecutar sin borrar nada) **y rendimiento de la API** (consultas N+1, índices, tiempos) | backend-laravel | — | En curso (sesión interactiva, 23/10 23:20) |
| 20 | **Rendimiento del 3D** (carga y renderizado más rápidos, sin cambiar qué pantallas lo muestran) + informe final de las oleadas 1c/1d | experto-3d | — | En curso (sesión interactiva, 23/10 23:20) |
| 21 | **Mapa de huecos**: backlog E0‑E15 contra la app real (qué falta, qué está a medias y qué espera a Alberto), con tareas propuestas para esta cola | producto | — | Hecho (23/10). [Informe](informes/2026-10-23-producto-mapa-de-huecos.md): de ahí salen las tareas 22‑30 (criterios de aceptación en su apartado 6) |
| 22 | **No prometer lo que no existe**: "Facturación" pasa a "Analítica" en el menú, en la paleta, en el Centro de control y en la portada | frontend-react | — | En curso (sesión interactiva, 23/10 23:40, junto con la 17) |
| 23 | **Analítica del taller** (E15‑2) en la misma pantalla que la 17 | frontend-react | — | En curso (sesión interactiva, 23/10 23:40, junto con la 17) |
| 25 | **Taller: "Mis órdenes"** para el mecánico y **actividad completa** del equipo (E12‑8, E13‑7) | frontend-react (taller) | — | En curso (sesión interactiva, 23/10 23:40) |
| 27 | **Cada lectura de km enlaza con su origen** (E7‑1). Paso 1: contrato (arquitecto). Paso 2: backend. Paso 3: `JournalTab` | arquitecto → backend-laravel → frontend-react | 19 para el paso 2 | Paso 1 en curso (sesión interactiva, 23/10 23:40) |
| 29 | **Derechos RGPD del cliente del taller**: exportar y anonimizar (E11‑6). Paso 1: contrato (arquitecto). Paso 2: backend con tests. Paso 3: `CustomerDetailPage` | arquitecto → backend-laravel → frontend-react (taller) | 19 para el paso 2; 25 para el paso 3 | Paso 1 en curso (sesión interactiva, 23/10 23:40) |
| 26 | **Particular: primeros pasos, km del año e historial por año** (E5‑7, E7‑5, E3‑3) | frontend-react | 16, 17 (mismos archivos) | Pendiente |
| 24 | **Resumen imprimible de la orden** ("no es una factura", E12‑9) | frontend-react (taller) | 25 (mismos archivos). D12 = A, decidido el 24/10 | Pendiente |
| 28 | **Recuperar la contraseña** (E1‑6), con correo solo en local. Paso 1: contrato. Paso 2: backend con tests. Paso 3: dos pantallas | arquitecto → backend-laravel → frontend-react | D17 = A, decidido el 24/10 | Paso 1 en curso (sesión interactiva, 24/10 09:10) |
| 30 | **Preparar las pruebas con usuarios** (E6‑6) | producto (+ Alberto) | 5 | Pendiente |
| 18 | **Dirección visual natural** ("se nota hecho con IA"): aplicar la propuesta que elija Alberto entre las del informe de UX | frontend-react, experto-3d | Decide Alberto (Preguntas para Alberto del tablero) | Bloqueado: Decide Alberto |
| 5 | Integración: recorrer TODA la app con las 4 cuentas demo (particular, owner, manager, mechanic) a 1280 y 360 px; anotar y repartir cada fallo a su agente; corregir desajustes de contrato | sesión principal + dueños | 1‑4, 16 | Pendiente |
| 6 | E2E con Playwright de los flujos principales (`frontend/e2e/`) + auditoría axe de cada pantalla | qa-tester | 5 | Pendiente |
| 7 | Auditoría de seguridad y privacidad (aislamiento, roles, archivos, Sanctum, dependencias) | seguridad | 3 | En curso (autopiloto, 2026-10-24 09:05): sobre el estado versionado; los endpoints nuevos de 27, 28 y 29 necesitarán una segunda pasada |
| 8 | Revisión UX/accesibilidad de todas las pantallas (360/768/1280, contraste, teclado, microcopias) | disenador-ux | 5 | Pendiente |
| 9 | Corregir hallazgos críticos y altos de 6‑8 | dueños | 6, 7, 8 | Pendiente |
| 10a | **Memoria del TFG, primer borrador completo** (objetivo de Alberto: memoria y defensa listas antes del 31/10). Capítulos que no dependen del aspecto final: introducción y objetivos, análisis y competencia, requisitos, casos de uso, diseño (arquitectura, E‑R, clases y secuencias contra el código real), implementación, planificación, conclusiones y bibliografía. Pruebas y manuales con huecos marcados | documentador-tfg | — | En curso (sesión interactiva, 24/10 09:10) |
| 10 | Documentación TFG que depende de la app terminada: capítulo de pruebas con resultados reales, manual de usuario con capturas, manual de instalación, anexo de la API | documentador-tfg | 5, 10a | Pendiente |
| 31 | **Defensa**: diapositivas (10‑15), guion de la demo en vivo con las cuentas demo, vídeo de respaldo (guion) y 20 preguntas probables del tribunal con respuesta | documentador-tfg + producto | 10a, 16 | Pendiente (objetivo: 29/10) |
| 32 | **E16 · Solicitudes de reparación a talleres** (pedido por Alberto el 24/10): directorio de talleres, solicitud desde el espacio personal, aceptar o rechazar, presupuesto ("no es una factura"), conversión en orden y notificaciones en la app. Paso 1: ADR-0007, contrato e historias | arquitecto | — | En curso (sesión interactiva, 24/10 14:15) |
| 33 | E16 · backend: modelos, rutas, policies, notificaciones, seed de 3‑4 talleres en el directorio y tests de aislamiento | backend-laravel | 32, 19 | Pendiente |
| 34 | E16 · frontend particular: directorio, nueva solicitud, seguimiento y respuesta al presupuesto, campana de notificaciones | frontend-react | 32, 16 | Pendiente |
| 35 | E16 · frontend taller: bandeja de solicitudes, aceptar o rechazar, presupuesto, convertir en orden y perfil del directorio en Ajustes | frontend-react (taller) | 32, 16 | Pendiente |
| 11 | CI en `.github/workflows/ci.yml` (PHP + Node) probado en local, y revisión de `iniciar-carcare.bat` | devops | 3 | En curso (autopiloto, 2026-10-24 09:05): probado sobre una exportación limpia del último commit |
| 12 | ~~Investigar proveedores con licencia de modelos reales y logotipos~~ | producto | — | Descartada (D16, 23/10: el proyecto no es comercial) |
| 13 | ~~Proponer contrato y ADR para la foto de portada del vehículo~~ | arquitecto | — | Aparcada (D16: "mantener la silueta y ya"; se reactiva solo si Alberto lo pide) |
| 14 | ~~Implementar la foto de portada~~ | backend-laravel, frontend-react | 13 | Aparcada (D16) |
| 15 | ~~Proporciones por modelo popular~~ | experto-3d | — | Descartada (D16: réplica por carrocería, sin modelos concretos) |

## Últimas ejecuciones

| Fecha y hora | Tareas | Resultado | Necesita a Alberto |
|--------------|--------|-----------|--------------------|
| 2026-10-23 08:56 | Ninguna de la cola + incidencia del lanzador | **Sin tarea elegible** (mismo motivo que a las 08:54). **Bug corregido en `autopiloto.ps1`:** la salida de Claude se colaba como valor de retorno, el bucle calculaba una espera vacía y relanzaba el piloto al segundo de terminar (esta ejecución nació así). Arreglo de 2 líneas verificado con una prueba aislada (0 errores de sintaxis; espera 3600 s tras una ejecución normal y hasta el reseteo si hay límite). **Piloto en PAUSA**: el proceso en marcha conserva el código viejo en memoria. Nota: [2026-10-23-autopiloto-0856](../../CarCare/05_sesiones/2026-10-23-autopiloto-0856.md). Commits locales, **sin push** (no hay remoto). | **Alberto, para reanudar:** 1) cierra la ventana "CarCare - piloto automatico"; 2) `reanudar.cmd`; 3) relanza el piloto (Win+R → `shell:startup` → "CarCare piloto automatico", o reinicia sesión). Sigue pendiente `scripts/github/conectar-github.cmd`. Opcional: `Write(**)` → `Edit(**)` en tu `settings.json` global (aviso en cada ejecución) |
| 2026-10-23 08:54 | Ninguna (revisión de la cola) | **Sin tarea elegible.** La 0 sigue sin sesión de GitHub (`gh auth status`: no hay sesión; `git remote` vacío). La 1‑4 están en la sesión interactiva (`En curso` desde las 08:55), así que no se tocan. De la 5 a la 11 dependen de ellas. No se lanzó ningún agente ni se tocó código. Commit local de la nota [2026-10-23-autopiloto-0854](../../CarCare/05_sesiones/2026-10-23-autopiloto-0854.md) y de esta fila; **sin push** porque no hay remoto. | **Alberto: ejecuta `scripts/github/conectar-github.cmd`** (desbloquea la tarea 0 y el push) |
| 2026-10-23 01:16 (prueba manual) | 12 y 13 en paralelo | **Prueba del piloto superada**: arrancó, leyó la cola, se marcó en el tablero y lanzó 2 agentes. Detenida a los pocos minutos por la sesión interactiva porque Alberto decidió D16 y ambas tareas dejaron de tener sentido. No llegó a modificar ningún archivo del proyecto. | — |
