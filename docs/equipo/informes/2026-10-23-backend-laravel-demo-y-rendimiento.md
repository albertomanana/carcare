# Informe backend-laravel — Datos demo completos y rendimiento de la API

- **Fecha:** 2026-10-23 (tarea 19 de `docs/equipo/AUTOPILOTO.md`)
- **Agente:** backend-laravel
- **Encargo:** (A) datos demo completos, aditivos e idempotentes; (B) medir y corregir consultas N+1 y tiempos de los GET que usan las pantallas, con tests que fijen un máximo de consultas.
- **Estado:** en curso (este informe se va completando mientras trabajo).

## Bitácora

- 23:20 Lectura de `CLAUDE.md`, contrato, `DemoSeeder`, router del frontend, informe anterior.
- Estado de la BD real `carcare` (solo lectura, `SELECT COUNT(*)`): ya tiene la demo sembrada hoy (4 usuarios, 22 vehículos, 33 intervenciones, 213 gastos, 31 órdenes, 112 actividades). No se toca.
- 23:21 BD `carcare_pruebas` creada, migrada y sembrada con el `DemoSeeder` actual (línea base). `db:show` no funciona en MariaDB 10.4 (falta `performance_schema.session_status`); compruebo la BD activa con `select database()` dentro de un envoltorio que aborta si no es `carcare_pruebas`.
- **23:22 Incidencia (resuelta):** el `DemoSeeder` actual hace `Storage::deleteDirectory("documents/{id}")`. Como `carcare` y `carcare_pruebas` comparten `storage/app/private` y los ids de espacio coinciden (1…5), sembrar la BD de pruebas **borró los 6 ficheros de documentos demo de la BD real** (filas 1‑6 de `documents`). Reparado en el acto: los PDF/PNG demo son deterministas (mismo título y vehículo ⇒ mismos bytes; los 6 tamaños coinciden con la columna `size`), así que copié los recién generados a las 6 rutas que espera `carcare` y saqué los míos del disco de Alberto. Verificado: `storage/app/private/documents/1` vuelve a tener exactamente los 6 ficheros referenciados por `carcare`. Desde entonces todos mis comandos llevan `LARAVEL_STORAGE_PATH=<scratchpad>/storage-pruebas` y el seeder nuevo no borra directorios.
- 23:25 Medición base: (1) consultas por endpoint en proceso (script que arranca la app como los tests y cuenta con `DB::listen`); (2) tiempos HTTP reales contra mi instancia :8030 con OPcache (login Sanctum SPA con cookie, mediana de 7). Comprobado que :8030 usa `carcare_pruebas` (las sesiones aparecen allí, no en `carcare`).
- 23:30 Perfil en caliente: lo que cuesta no son consultas (ya hay eager loading), sino PHP. En este equipo cada acceso a un atributo con cast + `Carbon::toDateString()` ronda 20 µs y `summary` hace ~3.500 en bucles sobre todo el historial; `Reminder::evaluate()` se recalcula decenas de veces por recordatorio al ordenar por urgencia.
- 23:35 "Foto" de 453 respuestas GET (las 4 cuentas, todos sus vehículos, clientes y órdenes) con la hora fija, para comparar byte a byte antes/después de optimizar. Dos pasadas seguidas: idénticas (el arnés es determinista).
- 24/10: MySQL se cayó al apagar el PC; relanzada la instancia :8030. Sin cambios de código hasta este punto.
