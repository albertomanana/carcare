# Informe · producto · backlog, decisiones y competencia

| Campo | Valor |
|-------|-------|
| Agente | producto |
| Fecha | 21/10/2026 |
| Encargo | Adaptar la planificación (`CarCare/`) al alcance ampliado (particular + taller + 3D), reestructurar el backlog contra el contrato v1, investigar la competencia con fuentes y preparar el guion de pruebas con usuarios |
| Estado | Hecho |

## 1. Objetivo

Que la carpeta de planificación refleje lo que se está construyendo en la oleada 1 (contrato v1, ADR 0001‑0004), que Alberto tenga claras las decisiones que solo él puede tomar, y que la diferenciación de CarCare se base en fuentes reales.

## 2. Qué cambió

| Archivo | Cambio |
|---------|--------|
| `CarCare/03_decisiones/registro-decisiones.md` | D2, D3 y D4 pasan a **Tomadas** ("Aceptada provisionalmente el 21/10/2026…", con enlace a su ADR). **D7** (particular + taller) y **D8** (3D) añadidas como tomadas por Alberto. D1 y D6 siguen pendientes; D5 queda **parcial** (Git local sin commits ni remoto). **Nuevas pendientes:** D9 orden de recorte, D10 modelo de negocio, D11 precio del taller, D12 facturación legal, D13 puente taller ↔ particular, D14 despliegue de la demo, D15 versiones sin soporte. Pendientes ordenadas por urgencia. |
| `CarCare/02_backlog/backlog-mvp.md` | Reescrito: E0‑E6 mantienen sus IDs con criterios alineados al contrato. Nuevas épicas **E7‑E15** (seguimiento diario, recordatorios y zonas 3D, documentos, informe, clientes, órdenes y elevadores, equipo y roles, experiencia 3D, analítica de espacio). En total **103 historias** (67 Must, 23 Should, 13 Could; 85 `En curso` y 18 `Pendiente`, recuento con `grep` sobre el archivo), cada una con para quién (P/T/P+T), MoSCoW, estado, dependencias y criterios "Dado / cuando / entonces". Incluye un **núcleo defendible** para recortar si hace falta (D9). |
| `CarCare/02_backlog/E8-6-mapa-zonas-3d.md`, `E12-2-tablero-kanban-elevadores.md`, `E12-5-entrega-orden-crea-intervencion.md` | Historias largas con la plantilla de historia (nuevas). |
| `CarCare/01_plan/plan-general.md` | Visión nueva, dos segmentos con hipótesis a validar, objetivos, alcance (dentro, fase 2, fase 3, solo investigar, fuera), arquitectura enlazada a los ADR, versiones del stack y **aviso de alcance**. |
| `CarCare/01_plan/riesgos.md` | Nuevos riesgos **R12‑R22** (alcance frente a calendario, rendimiento 3D, versiones recientes o sin soporte, multiespacio y roles, validación con talleres, mercado saturado, facturación legal, integración, valor real del 3D, RGPD de terceros, correo). R2 pasa a sustituido por R12; R4, R7 y R10 se revalúan. |
| `CarCare/01_plan/hoja-de-ruta.md` | Oleadas 0‑4 del tablero con su estado y una oleada 5 propuesta (validación con usuarios). Hitos H0‑H8 actualizados, sin fechas. |
| `CarCare/06_investigacion/competencia.md` | Análisis con fuentes: 5 apps de particulares, 8 programas de taller y el marco legal de VERI\*FACTU. Conclusiones sobre dónde sí y dónde no puede diferenciarse CarCare. |
| `CarCare/04_ideas/banco-ideas.md` | I1, I2 e I5 actualizadas (ya están en curso). Nuevas **I7‑I25** y preguntas abiertas. |
| `CarCare/06_investigacion/guion-prueba-usuarios.md` | Nuevo: guion para 3‑5 particulares y 2‑3 talleres con 8 + 8 tareas, métricas (éxito, tiempo, errores, SEQ, SUS, uso del 3D), preguntas de cierre y **umbrales de decisión fijados antes de las pruebas**. No contiene resultados. |
| `CarCare/00_LEEME.md` | Sección "Estado ahora mismo" actualizada. |
| `docs/equipo/TABLERO.md` | Solo mi fila. |

No he tocado código, `docs/` (salvo este informe y mi fila) ni `CarCare/07_memoria-tfg/`.

## 3. Decisiones que necesitan a Alberto (por urgencia)

1. **D6 Calendario.** Sin fechas no se puede saber si cabe el alcance ampliado. Es lo más urgente.
2. **D1 Guía de Ilerna.** Puede imponer tecnologías o alcance.
3. **D9 Orden de recorte.** Recomiendo aprobar ya el "núcleo defendible" como plan de contingencia. Lo primero que se recortaría: taller 3D, rayos X, portada 3D, analítica de taller, documentos e informe.
4. **D15 Versiones sin soporte.** Node 25 está sin parches de seguridad desde el 01/06/2026; PHP 8.2 los pierde el 31/12/2026 y Laravel 12 el 24/02/2027 (endoflife.date). Recomiendo pasar ya a Node LTS y subir a PHP 8.4 + Laravel 13 si la defensa es en 2027, cuanto antes.
5. **D5** Crear el remoto en GitHub privado y hacer el primer commit al cerrar la oleada 1 (sin eso no hay CI ni copia de seguridad).
6. **D12 Facturación.** Recomiendo **no emitir facturas** y rotular "Resumen de la orden (no es una factura)" e "Importe de órdenes entregadas". El RDL 15/2025 obliga a usar sistemas VERI\*FACTU desde el 01/01/2027 o el 01/07/2027 (verificado en el BOE).
7. **D13 Puente taller ↔ particular.** Es la tesis de diferenciación más fuerte (B: enlace de estado de la orden; C: el trabajo llega al garaje del cliente). Necesita un ADR de privacidad.
8. **D10/D11 Negocio y precio**, y **D14 Despliegue**: no bloquean el TFG. Recomiendo no construir pagos y validar con usuarios.

## 4. Hallazgos de competencia (consultados el 21/10/2026)

- **Lo básico para particulares ya existe y es barato o gratis.** Ejemplos: Fuelio Pro a 3,99 €/mes o 14,99 €/año ([App Store ES](https://apps.apple.com/es/app/fuelio-gas-tracker-mpg/id1487753318)); Drivvo con planes Free, Individual (24,90 $/año) y PRO (49,90 $/año), además de **versión web** y transferencia del historial al comprador ([precios](https://www.drivvo.com/en/pricing), [App Store ES](https://apps.apple.com/es/app/drivvo-gesti%C3%B3n-de-veh%C3%ADculos/id1206041425)); Simply Auto desde gratis hasta 9,99 $ ([simplyauto.app](https://www.simplyauto.app/)); AUTODOC CLUB gratis ([App Store ES](https://apps.apple.com/es/app/id1462874968)).
- **miDGT es gratis, usa datos oficiales y avisa de la caducidad de la ITV y del seguro** ([sede DGT](https://sede.dgt.gob.es/export/sites/dgt/es/appmidgt/index.html)). Los avisos de ITV de CarCare no son una ventaja: dependen de lo que teclee el usuario.
- **El software de taller en España es abundante y barato:** TallerMatic a 10 €/mes o 99 €/año con usuarios ilimitados y VERI\*FACTU ([tallermatic.com](https://www.tallermatic.com/)); Programa Taller a 79‑129 €/mes sin IVA, con **área del cliente y seguimiento de la reparación**, alertas de ITV e IA ([programa-taller.es](https://www.programa-taller.es/)). En EE. UU. y Reino Unido: Tekmetric desde 199 $/mes por taller ([pricing](https://www.tekmetric.com/pricing)), Shopmonkey desde 239 $/mes más 20 $ por usuario extra ([pricing](https://www.shopmonkey.io/pricing)) y Garage Hive desde 145 £/mes ([pricing](https://garagehive.co.uk/pricing/)). **El kanban y el portal del cliente no son diferenciales.**
- **Dónde puede diferenciarse CarCare (hipótesis):** (1) un solo producto para los dos lados, con el garaje del particular alimentado por cualquier taller (en las fuentes consultadas el área del cliente se limita a cada taller); (2) 3D ligado a datos reales (no encontré ninguna app comercial que lo haga en una búsqueda limitada, lo que **no prueba** que no exista ni que aporte valor); (3) honestidad de los datos frente a las apps de "salud" con OBD.
- **Marco legal:** [BOE‑A‑2025‑24446](https://www.boe.es/buscar/act.php?id=BOE-A-2025-24446) (RDL 15/2025), disposición final primera: sistemas adaptados antes del 01/01/2027 (art. 3.1.a) y antes del 01/07/2027 (resto).

## 5. Evidencias

- `git status` en la raíz: repositorio en la rama `master`, "does not have any commits yet", sin remotos (`git remote -v` vacío) → base de D5.
- `node -v` → `v25.6.1`. Versiones leídas de `frontend/package.json` (React ^19.3.1, Vite ^8.3.4, TypeScript ~6.0.3, R3F ^9.8.2, drei ^10.7.9, three ^0.186.1, React Router ^8.5.0) y de `backend/composer.json` (PHP ^8.2, Laravel ^12.0) → base de R14 y D15.
- Fechas de soporte: [endoflife.date/nodejs](https://endoflife.date/nodejs), [endoflife.date/php](https://endoflife.date/php) y [endoflife.date/laravel](https://endoflife.date/laravel), consultados el 21/10/2026.
- Todas las fuentes de competencia están en `CarCare/06_investigacion/competencia.md` con su URL y la fecha de consulta.

## 6. Limitaciones

- **No he instalado ni probado** ninguna app de la competencia: comparo lo que dicen sus webs y fichas, no la experiencia real.
- Google Play no se pudo leer (contenido truncado): no hay datos de Play Store. La web de Gemicar dio un error SSL.
- TuneraTaller, Gemicar, GestFuturo, los módulos de Odoo y las apps del artículo de Mapfre aparecen como **sin verificar**.
- La tabla de planes de Simply Auto se leyó aplanada: la asignación de funciones por plan está marcada como sin verificar.
- Que los fabricantes de software estén obligados por VERI\*FACTU desde el 29/07/2025 sale de fuentes secundarias, no del BOE.
- Los estados `En curso` del backlog se basan en el tablero ("API v1 completa", "SPA completa"). Cuando lleguen los informes de la oleada 1 habrá que ajustar las historias que no se hayan construido (p. ej. E10‑2 impresión, E14‑8 modo noche).
- El nº de pantallas (unas 30) y los valores y esfuerzos del banco de ideas son **estimaciones mías**, no mediciones.

## 7. Peticiones a otros agentes (propuestas; no las he añadido al tablero para no editar fuera de mi fila)

- **arquitecto / frontend-react:** mientras D12 siga abierta, usar en la UI "Importe de órdenes entregadas" en lugar de "facturación", y rotular la orden imprimible como "no es una factura".
- **devops / arquitecto:** valorar D15 (pasar a Node LTS ya).
- **documentador-tfg:** el backlog conserva los IDs E0‑E6 y añade E7‑E15; los requisitos pueden referenciarlos. La competencia, con fuentes, sirve para el capítulo "Análisis del problema y competencia".
- **experto-3d / frontend-react:** E14‑7 pide definir un **equipo de referencia** para medir los fps (idealmente el de la defensa).

## 8. Siguiente paso propuesto

1. Alberto responde D6, D1, D9 y D15.
2. Al cerrar la oleada 1, producto revisa los informes y ajusta los estados del backlog con evidencias.
3. Empezar a reclutar participantes (sobre todo talleres) durante la oleada 2 y hacer la sesión piloto del guion en cuanto el núcleo esté integrado.
