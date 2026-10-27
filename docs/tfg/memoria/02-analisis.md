# 2. Análisis del problema y de la competencia

## 2.1 El problema

### Lado del particular

La documentación de partida (`Car_Care_Documentacion/01_Vision_y_producto.md`, §2) describe un propietario cuya información está repartida entre facturas, PDF, mensajes y su memoria. Eso le dificulta:

- recordar mantenimientos y reparaciones anteriores y qué piezas se cambiaron;
- conservar facturas y documentos ordenados;
- anticipar gastos y vencimientos (ITV, seguro, impuesto, revisiones);
- conocer el coste real de mantener el vehículo;
- preparar un historial ordenado al venderlo.

Es una descripción del autor y **no se ha contrastado todavía con usuarios**: no se ha hecho ninguna entrevista (la carpeta `CarCare/06_investigacion/` solo contiene la plantilla de entrevista y el guion de pruebas, sin resultados). El capítulo 12 recoge esa validación cuando exista.

### Lado del taller

Para un taller independiente pequeño (entre 1 y 12 elevadores, con dueño, encargado y mecánicos), la planificación del proyecto formula el problema como una hipótesis: seguir qué coche está en qué fase y en qué elevador, quién lo lleva, qué se prometió al cliente y cuál es el historial de cada vehículo (`CarCare/01_plan/plan-general.md`, §2). Tampoco está validada con talleres reales.

## 2.2 Usuarios y roles

*Tabla 2.1. Perfiles de usuario y su rol en CarCare.*

| Perfil | Necesidad principal | Rol en CarCare |
|--------|---------------------|----------------|
| Particular con uno o varios coches, sobre todo usados | Registrar en segundos km, repostajes y gastos; saber qué le toca y cuánto le cuesta el coche | Propietario (`owner`) de su espacio `personal` |
| Propietario de un taller | Ver el estado del taller, el importe de lo entregado y gestionar al equipo | `owner` del espacio `workshop` |
| Gerente o encargado | Lo mismo que el propietario, salvo eliminar el taller | `manager` |
| Mecánico | Ver y mover sus órdenes, registrar el trabajo hecho en el vehículo; no necesita ver importes | `mechanic` |

Una misma persona puede ser particular en su espacio personal y mecánico en un taller con la misma cuenta (ADR‑0002).

### Hipótesis de producto (no son hechos)

La planificación las formula para validarlas con usuarios (`CarCare/01_plan/plan-general.md`, §2):

*Tabla 2.2. Hipótesis de producto pendientes de validar.*

| ID | Hipótesis |
|----|-----------|
| H‑P1 | Un particular registra un repostaje en menos de 30 s desde el móvil si el acceso está a un toque |
| H‑P2 | Ver el coche en 3D con sus zonas ayuda a entender qué toca revisar mejor que una lista, o al menos motiva a volver |
| H‑P3 | El informe exportable tiene valor real al vender el coche |
| H‑T1 | Un tablero kanban con elevadores se entiende más rápido que el método actual del taller |
| H‑T2 | El taller valora que el trabajo entregado quede en el historial del coche y, más adelante, llegue al cliente |
| H‑T3 | Un taller probaría CarCare sin facturación legal si convive con su programa de facturación |

## 2.3 Análisis de la competencia

### Método y límites

El análisis lo hizo el agente de producto el 21/10/2026 ([`CarCare/06_investigacion/competencia.md`](../../../CarCare/06_investigacion/competencia.md)). Consultó las webs oficiales y páginas de precios de cada producto, las fichas de la App Store de España y las páginas oficiales de la DGT y del BOE. **Fecha de consulta de todas las fuentes: 21/10/2026.**

Tiene tres límites que conviene declarar:

1. **No se instalaron ni probaron las aplicaciones.** Lo que sigue describe lo que dicen sus webs y fichas, no su calidad real.
2. Las fichas de Google Play no se pudieron leer, así que no hay datos de esa tienda.
3. Los precios cambian según el país, la tienda y la fecha. [PENDIENTE: tarea 10 — volver a comprobar los precios antes de entregar la memoria.]

### Aplicaciones para particulares

*Tabla 2.3. Aplicaciones para particulares.*

| Aplicación | Plataformas | Precio publicado (21/10/2026) | Puntos fuertes según su fuente | Lo que no aparece en la fuente |
|------------|-------------|-------------------------------|-------------------------------|--------------------------------|
| **Drivvo** | Android, iOS y web | Gratis (2 vehículos) · Individual 24,90 $/año · PRO 49,90 $/año · Fleet 42 $/vehículo/año | Repostajes y consumo, gastos, recordatorios por fecha o km, coste por día y por km; transferencia del historial entre comprador y vendedor; 4,6/5 con 345 valoraciones en la App Store de España | Gestión de talleres; visualización 3D |
| **Fuelio** | Android, iOS | Gratis + Pro 3,99 €/mes o 14,99 €/año | Repostajes y consumo con gráficos, varios combustibles, datos en el dispositivo sin cuenta; la versión Pro añade recordatorios y escaneo de tickets | Versión web; cuentas compartidas o modo profesional |
| **Simply Auto** | Android, iOS; web solo de pago | Gratis (4 vehículos, con anuncios) · Gold 9,99 $ · Platinum 9,99 $/año | Repostajes, viajes, recordatorios, gastos, informes, documentos en el plan superior | Gestión de taller; 3D |
| **AUTODOC CLUB** | iOS | Gratis | Gastos, recordatorios, historial de reparaciones con foto del ticket, guías en vídeo | 3,2/5 con 21 valoraciones; reseñas de pérdida de datos; ligada a un vendedor de recambios |
| **miDGT** (oficial) | iOS, Android | Gratis | Datos oficiales del vehículo, última ITV con km anotados, aseguradora; avisa de la caducidad de la ITV y del seguro | No registra gastos, repostajes ni historial de taller |

### Software de gestión de talleres

*Tabla 2.4. Software de gestión de talleres.*

| Producto | País | Precio publicado (21/10/2026) | Puntos fuertes según su fuente |
|----------|------|-------------------------------|-------------------------------|
| **Tekmetric** | EE. UU. | 199‑439 $/mes por taller | Inspección digital, autorizaciones y facturación digitales, tablero de técnicos, analítica |
| **Shopmonkey** | EE. UU. | 239‑499 $/mes, 3‑5 usuarios incluidos, +20 $/mes por usuario | Inspecciones digitales, mensajería con el cliente, flujo de trabajo configurable |
| **Garage Hive** | Reino Unido | Desde 145 £/mes | Presupuestos, partes y facturas, planificador, recordatorios automáticos de la MOT (la ITV británica) |
| **TallerMatic** | España | 99 €/año o 10 €/mes, usuarios ilimitados | Clientes, vehículos, presupuestos, órdenes, citas, stock y facturación con VERI\*FACTU y TicketBAI |
| **Programa Taller** | España | 79‑129 €/mes sin IVA | Órdenes por matrícula, alertas de mantenimiento e ITV, área del cliente con su historial y seguimiento de la reparación (limitada a ese taller) |

Otros productos citados en comparativas (TuneraTaller, Gemicar, GestFuturo, módulos de Odoo) no se pudieron comprobar en sus webs oficiales y no se usan como evidencia.

### Contexto legal que afecta al modo taller

El Real Decreto‑ley 15/2025 (BOE‑A‑2025‑24446, BOE n.º 290 de 03/12/2025), en su disposición final primera, fija que los contribuyentes del artículo 3.1.a) del reglamento de sistemas informáticos de facturación (RD 1007/2023) deben tener adaptados sus sistemas antes del 01/01/2027, y el resto antes del 01/07/2027 (fuente consultada el 21/10/2026). Si CarCare emitiera facturas, sería uno de esos sistemas. Por eso se decidió calcular los importes de la orden sin emitir facturas y rotularlos como "Importe de órdenes entregadas" y "Resumen de la orden (no es una factura)" (decisión D12 = A, 24/10/2026).

## 2.4 Conclusiones del análisis

### Lo que no diferencia a CarCare

1. **Gastos, repostajes, consumo, recordatorios e informes del particular.** Fuelio, Drivvo, Simply Auto y AUTODOC CLUB ya lo ofrecen gratis o por menos de 50 € al año, y dos de ellas tienen versión web.
2. **Avisos de ITV y seguro.** miDGT los da gratis y con datos oficiales. CarCare solo puede avisar con las fechas que introduce el usuario, y no lo presenta como ventaja.
3. **Historial para vender el coche.** Drivvo ya transfiere el historial entre comprador y vendedor.
4. **Software de taller.** Kanban, citas, área del cliente e incluso facturación legal existen en España desde 10 €/mes.

### Dónde puede diferenciarse (hipótesis por validar)

1. **Un solo producto para los dos lados del mostrador.** En las fuentes consultadas, las aplicaciones de particulares no tienen modo taller y los programas de taller tienen, como mucho, un área del cliente limitada a ese taller. Es la hipótesis más prometedora y también la más cara de construir.
2. **Visualización 3D ligada a datos reales** (zonas con su historial y sus recordatorios; elevadores con sus órdenes). En una búsqueda limitada no apareció ninguna aplicación comercial que la ofrezca. Que no apareciera no prueba que no exista, y no está demostrado que aporte valor: es la hipótesis H‑P2 y el riesgo R20.
3. **Honestidad de los datos.** Frente a aplicaciones que prometen "salud" o diagnóstico, CarCare solo muestra lo que se puede calcular con datos del usuario y rotula el resto.

### Consecuencias para el proyecto

- Las funciones básicas se construyen bien porque son la entrada al producto, aunque no diferencien.
- No se compite en facturación, inventario, peritación, SMS o precios de combustible.
- La siguiente fase debe empezar por unir los dos lados. Esa línea ha empezado el 24/10/2026 con la función de solicitudes de reparación de un particular a un taller (capítulo 13).

## 2.5 Viabilidad técnica

*Tabla 2.5. Viabilidad técnica.*

| Aspecto | Valoración | Fuente |
|---------|------------|--------|
| Entorno disponible | PHP 8.2.12 y MariaDB 10.4 (XAMPP), Node 25 en el equipo del autor. Laravel 12 es la última versión compatible con PHP 8.2 | ADR‑0001; `CLAUDE.md` |
| Soporte de versiones | Node 25 sin soporte de seguridad desde el 01/06/2026; PHP 8.2 hasta el 31/12/2026; Laravel 12 hasta el 24/02/2027 (endoflife.date, consultado el 21/10/2026). Decisión D15 pendiente | Riesgo R14 |
| 3D sin recursos externos | Viable con geometría procedural e iluminación generada (sin descargas de modelos ni texturas) | ADR‑0004 |
| Coste | Cero: todo se ejecuta en local y no se contrata ningún servicio. El correo de recuperación de contraseña se escribe en el registro local (D17 = A) | D14, D17 |
