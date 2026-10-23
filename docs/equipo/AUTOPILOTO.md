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
4. Encárgasela al agente indicado (los de `.claude/agents/`) con un encargo concreto: objetivo, archivos, criterios de aceptación y verificación. Máximo **2 agentes en paralelo** y solo si sus zonas no se solapan. **Espera a que terminen** antes de acabar la sesión.
5. Verifica tú el resultado (tests, build, prueba de humo o capturas). Marca la tarea `Hecho` con enlace al informe, o `Bloqueado` con el motivo exacto.
6. Si queda margen, sigue con la siguiente tarea. Antes de terminar, escribe la nota de sesión en `CarCare/05_sesiones/AAAA-MM-DD-autopiloto-HHMM.md` y añade una fila en **Últimas ejecuciones** (fecha, tareas, resultado, qué necesita a Alberto).
7. Si una tarea se corta a medias (por ejemplo, por el límite de uso), déjala `En curso` con una nota de dónde se quedó: la siguiente ejecución la retoma inspeccionando el disco, sin rehacer.

8. **Git (autorizado por Alberto el 23/10/2026):** al terminar, commits en la rama `develop` siguiendo [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (un commit por área tocada, Conventional Commits en español) y `git push origin develop`. Antes de cada commit, comprueba con `git status` que no se cuela ningún `.env` ni archivos de `storage/`. Si la rama actual no es `develop`, no hagas commit y anótalo.

**Prohibido sin autorización escrita de Alberto en este documento:** commit o push a `main`, `push --force`, crear o borrar ramas, borrar datos o ejecutar `migrate:fresh` sin volver a sembrar, tocar `Car_Care_Documentacion/`, instalar software global, contratar o llamar a servicios externos de pago, publicar nada fuera del PC y tomar decisiones reservadas a Alberto (las marcadas `Decide Alberto`). Ante la duda, se anota la pregunta en "Últimas ejecuciones" y se pasa a otra tarea.

## Cola de tareas

Estados: `Pendiente` · `En curso` · `Hecho` · `Bloqueado`. Prioridad de arriba abajo.

| # | Tarea | Agente | Depende de | Estado |
|---|-------|--------|------------|--------|
| 0 | **Publicar en GitHub** (pedido por Alberto el 23/10): si `.tools/gh/bin/gh.exe auth status` dice que hay sesión y `git remote` está vacío, ejecutar `bash scripts/github/publicar-repo.sh` (crea el repo privado, `main` mínima y `develop` con commits por área). Si no hay sesión, dejarla `Pendiente` y anotar en "Últimas ejecuciones": "Alberto: ejecuta scripts/github/conectar-github.cmd" | sesión principal | Sesión de GitHub iniciada por Alberto | Pendiente |
| 1 | Oleada 1c: terminar pantallas del modo particular (intervención, documentos, datos, agenda, analítica, informe, ajustes, index.html) | frontend-react | — | En curso (sesión interactiva, 23/10) |
| 2 | Oleada 1c: terminar modo taller (centro de control, kanban, órdenes, clientes, equipo, taller 3D, pestaña órdenes) | frontend-react | — | En curso (sesión interactiva, 23/10) |
| 3 | Oleada 1c: cerrar tests de la API e informe | backend-laravel | — | Hecho (23/10): 462 tests / 6959 aserciones en verde, verificado por la sesión principal. [Informe](informes/2026-10-23-backend-laravel-api-v1.md) |
| 4 | Oleada 1c: taller 3D, escena de portada, marcadores de zona sin solapes, pulido | experto-3d | — | En curso (sesión interactiva, 23/10) |
| 5 | Integración: recorrer TODA la app con las 4 cuentas demo (particular, owner, manager, mechanic) a 1280 y 360 px; anotar y repartir cada fallo a su agente; corregir desajustes de contrato | sesión principal + dueños | 1‑4 | Pendiente |
| 6 | E2E con Playwright de los flujos principales (`frontend/e2e/`) + auditoría axe de cada pantalla | qa-tester | 5 | Pendiente |
| 7 | Auditoría de seguridad y privacidad (aislamiento, roles, archivos, Sanctum, dependencias) | seguridad | 5 | Pendiente |
| 8 | Revisión UX/accesibilidad de todas las pantallas (360/768/1280, contraste, teclado, microcopias) | disenador-ux | 5 | Pendiente |
| 9 | Corregir hallazgos críticos y altos de 6‑8 | dueños | 6, 7, 8 | Pendiente |
| 10 | Documentación TFG contra el código real: modelo de datos, clases, secuencia, API (OpenAPI o tabla), manual de usuario con capturas, manual de instalación | documentador-tfg | 5 | Pendiente |
| 11 | CI en `.github/workflows/ci.yml` (PHP + Node) probado en local, y revisión de `iniciar-carcare.bat` | devops | 5 | Pendiente |
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
