# 1. Introducción y objetivos

## 1.1 Contexto

Este trabajo es el proyecto final del ciclo de Desarrollo de Aplicaciones Web (DAW) de Ilerna. Su objetivo académico es demostrar, en un único sistema, las competencias del ciclo: diseño de bases de datos, desarrollo en servidor, desarrollo en cliente, diseño de interfaces, despliegue y documentación.

El punto de partida fue una documentación de producto escrita por el autor el 20/10/2026 (carpeta `Car_Care_Documentacion/`). Describía un "centro de control personal del automóvil" para propietarios particulares y dejaba fuera del alcance inicial el portal de talleres. El 21/10/2026 el autor amplió el alcance con dos peticiones explícitas, registradas como decisiones D7 y D8 en [`CarCare/03_decisiones/registro-decisiones.md`](../../../CarCare/03_decisiones/registro-decisiones.md):

- **D7.** El mismo producto debe servir a la vez a un particular que sigue su coche y a un taller que gestiona su flota.
- **D8.** La interfaz debe ser interactiva en 3D, con la condición de no mostrar nunca datos que no existen.

El 23/10/2026 el autor fijó otra condición (D16): el proyecto no tiene fines comerciales y no usa modelos 3D ni logotipos de marcas reales.

## 1.2 Motivación

La información de un coche suele estar repartida entre facturas en papel, PDF, mensajes y la memoria del propietario. Eso dificulta recordar qué se le hizo y cuándo, anticipar vencimientos, conocer el coste real del vehículo y preparar un historial ordenado al venderlo (`Car_Care_Documentacion/01_Vision_y_producto.md`, §2). En los talleres pequeños, el problema análogo es saber qué coche está en qué fase y en qué elevador, quién lo lleva y qué se prometió al cliente.

El capítulo 2 muestra que ya existen aplicaciones para cada uno de los dos lados por separado. La motivación técnica del proyecto es otra: construir los dos modos sobre un mismo modelo de datos, con un control de acceso estricto y con una visualización 3D ligada a datos reales. Son tres problemas de ingeniería con interés propio:

1. aislamiento entre espacios de trabajo en una aplicación multiinquilino;
2. integridad de datos económicos y de kilometraje;
3. gráficos 3D en el navegador sin penalizar la carga ni la accesibilidad.

Estos problemas, y no la novedad del producto, son el eje de la memoria.

## 1.3 Objetivos

### Objetivo general

Diseñar, construir, probar y documentar una aplicación web completa que permita a un particular llevar el seguimiento de sus vehículos y a un taller gestionar clientes, vehículos y órdenes de trabajo con su equipo, sobre una misma base de datos y una misma API, con una interfaz que incluya visualización 3D accesible y que no muestre ninguna cifra sin una fuente real.

### Objetivos específicos

Cada objetivo tiene un criterio verificable. La columna *Estado* indica la situación a 26/10/2026 y la evidencia; lo que no se ha comprobado figura como pendiente.

*Tabla 1.1. Objetivos específicos, criterio de cumplimiento y estado.*

| ID | Objetivo específico | Criterio de cumplimiento | Estado a 26/10/2026 |
|----|---------------------|--------------------------|---------------------|
| OE‑1 | Implementar una API REST versionada que cumpla un contrato escrito antes que el código | Todas las rutas del contrato v1 existen bajo `/api/v1` y cada forma JSON coincide clave a clave con `frontend/src/api/types.ts` | **Cumplido.** 72 rutas (`php artisan route:list --path=api`, ejecutado el 26/10; índice en el anexo A). La prueba `ContractShapeTest` compara cada respuesta con su tipo (capítulo 8) |
| OE‑2 | Garantizar que ningún usuario accede a datos de un espacio al que no pertenece | Cada ruta con recurso responde 404 a un usuario ajeno; una prueba falla si aparece una ruta sin su caso de aislamiento | **Cumplido en la API.** `IsolationTest` con 226 casos sobre las 60 rutas con recurso (26/10). [PENDIENTE: tarea 7 — auditoría de seguridad independiente] |
| OE‑3 | Proteger las reglas de negocio críticas: dinero exacto, gasto sin doble conteo, kilometraje coherente y numeración de órdenes sin huecos | Cada regla tiene pruebas automáticas que pasan sobre SQLite y sobre MariaDB | **Cumplido.** 511 pruebas y 7.864 aserciones en verde sobre SQLite (26/10). Sobre MariaDB pasó la batería anterior, de 462 pruebas (23/10). [PENDIENTE: tarea 11 — repetir sobre MariaDB] |
| OE‑4 | Construir la aplicación de página única con los dos modos | Las historias *Must* del núcleo defendible del backlog funcionan contra la API real | **Construido, sin verificar.** 71 de 90 historias *Must* y *Should* construidas a 23/10 (mapa de huecos de producto); desde entonces se han añadido la analítica y "Mis órdenes" (capítulo 7, §7.8). [PENDIENTE: tarea 5 — recorrido completo con las 4 cuentas demo] |
| OE‑5 | Representar el vehículo y el taller en 3D generados por código, con alternativa 2D y carga diferida | 9 carrocerías procedurales; three.js fuera del paquete inicial; un único lienzo WebGL por pantalla; respaldo SVG sin WebGL | **Parcial.** Las carrocerías, la alternativa 2D y un lienzo por pantalla existen, pero el *build* de producción todavía precarga three.js en todas las pantallas (capítulo 7, §7.6.4). [PENDIENTE: tarea 20 — corregirlo y medir carga y fotogramas] |
| OE‑6 | Cumplir WCAG 2.2 nivel AA en todas las pantallas | 0 incidencias críticas o serias de axe; uso completo por teclado; sin desbordes a 360, 768 y 1280 px | **Pendiente.** [PENDIENTE: tareas 6 y 8 — auditoría axe y revisión manual] |
| OE‑7 | Automatizar la verificación del sistema | Pruebas extremo a extremo de los recorridos principales e integración continua en cada envío al repositorio | **Pendiente.** [PENDIENTE: tareas 6 y 11 — E2E con Playwright y CI] |
| OE‑8 | Documentar el sistema para su mantenimiento y su defensa | Contrato de API, decisiones de arquitectura, diagramas regenerables, memoria y manuales | **En curso.** Contrato y 7 ADR existen; este borrador; manual de usuario en la tarea 10 |
| OE‑9 | Contrastar el producto con usuarios reales | Sesiones con 3‑5 particulares y 2‑3 talleres según un guion con umbrales fijados antes de las pruebas | **Pendiente.** El guion existe (`CarCare/06_investigacion/guion-prueba-usuarios.md`). [PENDIENTE: tarea 30 — sesiones con usuarios; depende de Alberto] |

## 1.4 Alcance

**Dentro del alcance** (contrato de la API v1, [`docs/api/contrato-v1.md`](../../api/contrato-v1.md)):

- **Común a los dos modos:** registro, sesión, perfil y baja de la cuenta; espacios de trabajo y cambio entre ellos; vehículos con archivado; intervenciones con líneas de detalle; kilometraje con control de retrocesos; recordatorios por fecha o kilómetros con recurrencia; mapa de zonas del vehículo; documentos privados; registro de actividad.
- **Particular:** gastos con gasto vinculado a las intervenciones, repostajes y consumo, diario del vehículo, coste por kilómetro solo con datos suficientes, panel de inicio, analítica e informe imprimible.
- **Taller:** clientes, órdenes de trabajo numeradas con líneas e IVA, tablero kanban, elevadores sin conflictos, entrega de la orden que crea la intervención en el historial del vehículo, equipo con roles (propietario, gerente, mecánico) y analítica del importe de las órdenes entregadas.
- **3D:** coche procedural por carrocería y color, vista de rayos X rotulada como ilustración, taller en 3D, portada y miniaturas estáticas, con silueta 2D de respaldo.

**Fuera del alcance**, con su motivo:

*Tabla 1.2. Funciones fuera del alcance y motivo.*

| Función | Motivo |
|---------|--------|
| Facturas legales | CarCare calcula los importes de la orden, pero no emite facturas. Hacerlo lo convertiría en un sistema informático de facturación sujeto al RD 1007/2023 (VERI\*FACTU). Decisión D12 = A, tomada por el autor el 24/10/2026 |
| Diagnóstico, "salud" del vehículo o desgaste medido | No hay sensores ni integraciones que lo midan. El estado de cada zona se rotula siempre "según tus intervalos, no medido" |
| Conexión OBD‑II, consulta oficial de matrícula o VIN, datos de la DGT | Requieren proveedores autorizados o integraciones no disponibles (`Car_Care_Documentacion/02_Requisitos_y_modulos.md`, "Fuera del MVP inicial") |
| Pagos y suscripciones | Sin modelo de negocio validado (D10 recomienda no construir pagos en el TFG) |
| Modelos 3D y logotipos de marcas | Licencias y marcas registradas (ADR‑0004 y D16) |

Las funciones que se han decidido o empezado después de cerrar el alcance inicial (recuperación de contraseña, derechos RGPD del cliente del taller y solicitudes de reparación de un particular a un taller) se describen en los capítulos 6 y 13 según su estado.

## 1.5 Estructura del documento

- El **capítulo 2** analiza el problema, los usuarios y la competencia con fuentes fechadas.
- El **capítulo 3** expone la planificación real y la metodología, incluido el uso de un asistente de programación con IA.
- Los **capítulos 4 y 5** recogen los requisitos y los casos de uso, trazados hasta las historias del backlog y las pruebas.
- El **capítulo 6** describe el diseño (arquitectura, decisiones, modelo de datos, clases, secuencias e interfaz).
- El **capítulo 7** describe la implementación, con fragmentos del código real.
- Los **capítulos 8 a 12** cubren pruebas, despliegue, manuales y validación. Las pruebas del backend, el despliegue en local y el manual de instalación están redactados; el manual de usuario es un esqueleto que espera a la simplificación de la interfaz, y la validación con usuarios es solo un plan, porque no se ha hecho ninguna sesión.
- El **capítulo 13** recoge conclusiones y trabajo futuro; el **14**, la bibliografía, y el **15**, los anexos (índice de la API, decisiones de arquitectura y glosario).
