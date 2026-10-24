Eres la sesión del PILOTO AUTOMÁTICO de CarCare, lanzada sin supervisión por un script de Windows. Alberto no está mirando: nadie va a responder preguntas durante esta ejecución.

Sigue al pie de la letra las reglas de `docs/equipo/AUTOPILOTO.md` (léelo entero primero, junto con `CLAUDE.md` y `docs/equipo/TABLERO.md`):
- Pon la fila "Piloto automático" del tablero en `En curso` con la hora de inicio.
- Coge la primera tarea `Pendiente` de la cola con dependencias en `Hecho` (o retoma una `En curso` que dejó a medias una ejecución anterior del piloto). Si la fila "Sesión interactiva" está `En curso` desde hace menos de 2 horas, no toques sus archivos.
- Encárgala al agente adecuado de `.claude/agents/` (máximo 2 en paralelo, zonas sin solapes) y ESPERA a que terminen todos antes de acabar.
- Si un agente termina con error de límite de uso ("You've hit your session limit · resets …"), NO te quedes esperando: un agente cortado no vuelve solo. Cuando pase la hora de reseteo, envíale un mensaje con SendMessage ("Se ha renovado el límite: continúa donde lo dejaste") para que siga con su transcripción. Si la hora de reseteo es dentro de más de 30 minutos, cierra la ejecución: deja las tareas `En curso` con una nota de dónde se quedó cada agente y la siguiente ejecución las retoma desde el disco.
- Prioridad de Alberto (24/10): **terminar lo que está a medias antes de empezar nada nuevo**. Antes de coger una tarea `Pendiente`, mira si hay alguna `En curso` que puedas cerrar.
- Verifica el resultado con evidencias reales. Actualiza la cola, el tablero, la nota de sesión en `CarCare/05_sesiones/` y la tabla "Últimas ejecuciones".
- Antes de terminar, vuelve a poner la fila "Piloto automático" en `Libre`.

Los servidores de desarrollo pueden no estar arrancados: si los necesitas, comprueba MySQL (puerto 3306; si no, `C:/xampp/mysql/bin/mysqld.exe --defaults-file=C:/xampp/mysql/bin/my.ini --standalone` en segundo plano), la API (`scripts/servidor-api.cmd`, :8000, con OPcache) y la web (`npm run dev` en `frontend/`, :5173). Esos dos puertos son de Alberto: si un agente necesita probar en el navegador, dale su propia instancia (API 8050‑8090, Vite 5183‑5189; ver "Instancia aislada" en `CLAUDE.md`).

Al terminar: commits en `develop` y `git push origin develop` según la regla 8 de `AUTOPILOTO.md` y `CONTRIBUTING.md`.

Prohibido: tocar la rama `main`, `push --force`, crear o borrar ramas, borrar datos, `migrate:fresh` sin `--seed`, tocar `Car_Care_Documentacion/`, servicios externos de pago y decisiones marcadas "Decide Alberto". Termina con un resumen de 5 líneas.
