# 13. Conclusiones y trabajo futuro

> Capítulo **provisional**, escrito el 26/10/2026, antes de las pruebas extremo a extremo, la auditoría de accesibilidad y de seguridad y la validación con usuarios. [PENDIENTE: tarea 10 — revisarlo con los resultados de los capítulos 8 y 12 antes de entregar.]

## 13.1 Cumplimiento de los objetivos

La tabla actualiza la del capítulo 1 (§1.3) con lo que se puede comprobar a 26/10/2026.

*Tabla 13.1. Cumplimiento de los objetivos específicos a 26/10/2026.*

| ID | Objetivo | Estado a 26/10/2026 | Evidencia |
|----|----------|---------------------|-----------|
| OE‑1 | API REST que cumple un contrato escrito antes que el código | **Cumplido** para las 72 rutas del commit `f1265b6` | `ContractShapeTest` compara cada respuesta con su tipo de `types.ts` (capítulo 8), incluidas las respuestas nuevas de las tareas 27, 28 y 29 (`MileageLog.source_id`, `Customer.anonymized_at`, `CustomerExport`) |
| OE‑2 | Ningún usuario accede a datos de un espacio ajeno | **Cumplido en la API**; falta la auditoría independiente | `IsolationTest`: 404 en las 60 rutas con recurso y una guardia que falla si aparece una ruta sin su caso. [PENDIENTE: tarea 7] |
| OE‑3 | Reglas críticas protegidas (dinero, gasto vinculado, kilometraje, numeración) | **Cumplido**, salvo la concurrencia | 511 pruebas y 7.864 aserciones en verde sobre SQLite (26/10); la batería anterior, de 462 pruebas, también pasó sobre MariaDB (23/10). La numeración simultánea no tiene una prueba con dos procesos |
| OE‑4 | La SPA con los dos modos contra la API real | **Construido, sin verificar** | 71 de 90 historias *Must* y *Should* construidas el 23/10; desde entonces se han cerrado la analítica (tareas 17, 22 y 23) y "Mis órdenes" (25). [PENDIENTE: tarea 5 — recorrido completo con las 4 cuentas] |
| OE‑5 | 3D generado por código, con alternativa 2D y carga diferida | **Parcial** | Las 9 carrocerías, la alternativa 2D y un lienzo por pantalla existen. La carga diferida no se cumple en el *build* de producción (§7.6.4). [PENDIENTE: tarea 20] |
| OE‑6 | WCAG 2.2 AA | **Pendiente** | [PENDIENTE: tareas 6 y 8] |
| OE‑7 | Verificación automática: E2E e integración continua | **Pendiente** | No existen `frontend/e2e/` ni `.github/workflows/`. [PENDIENTE: tareas 6 y 11] |
| OE‑8 | Documentación para el mantenimiento y la defensa | **En curso** | Contrato, 7 ADR y este primer borrador completo de la memoria, con los quince capítulos; manual de usuario en esqueleto y validación solo como plan. [PENDIENTE: tareas 10 y 31] |
| OE‑9 | Contraste con usuarios reales | **Pendiente** | Guion y plan listos (capítulo 12); ninguna sesión hecha. [PENDIENTE: tarea 30] |

**Valoración.** Los objetivos de **servidor** (OE‑1 a OE‑3) están cumplidos y probados. Los de **cliente** (OE‑4 a OE‑6) están construidos pero sin la verificación que exige la definición de terminado del proyecto (pruebas E2E, accesibilidad y tres anchos de pantalla). Los de **proceso** (OE‑7 a OE‑9) están pendientes. La diferencia refleja el orden en que se ha trabajado: primero el contrato y la API, que es donde un error cuesta más (fugas de datos, importes mal calculados), y después la interfaz.

## 13.2 Lo que ha funcionado

1. **Escribir el contrato antes que el código.** Las formas JSON de `frontend/src/api/types.ts` y las reglas de `docs/api/contrato-v1.md` permitieron construir servidor y cliente a la vez con agentes distintos. Convertir el contrato en una prueba (`ContractShapeTest` y `tests/Support/Contract.php`) lo hizo verificable: si el servidor añade, quita o cambia el tipo de un campo, la batería falla. Los cambios posteriores (origen de las lecturas, RGPD, recuperar la contraseña) se han hecho de la misma forma: primero el contrato y su historial, después el código.
2. **Una sola pieza para la autorización.** Todas las *policies* heredan de `WorkspaceScopedPolicy`, que decide entre 404 y 403 en un único método, y cada ruta declara su capacidad con `->can()`. Eso, junto a la guardia de `IsolationTest` que compara sus casos con las rutas registradas, convierte la regla "una prueba de aislamiento por endpoint" en algo que no depende de acordarse.
3. **Las reglas de negocio en servicios con transacciones.** El gasto vinculado, el kilometraje y la numeración tienen cada uno un único punto de escritura (`MaintenanceService::syncLinkedExpense()`, `MileageService`, `WorkOrderService`). Por eso se pueden probar con importes y kilómetros conocidos, y por eso los datos de demostración, que usan esos mismos servicios, cumplen las mismas reglas que los reales.
4. **Dinero en céntimos enteros.** `App\Support\Money` evita la coma flotante en todo el servidor; el IVA y los totales cuadran al céntimo.
5. **Un 3D que comparte geometría con su alternativa 2D.** Los perfiles de las carrocerías no dependen de three.js, de modo que la silueta SVG de respaldo y el modelo 3D tienen la misma forma, y las miniaturas de los listados pudieron pasar a SVG sin perder parecido.
6. **Informes con evidencias.** Cada agente dejó un informe con los comandos ejecutados y su resultado. Esta memoria se ha podido escribir citando esos informes en lugar de reconstruir lo ocurrido de memoria.

## 13.3 Dificultades y errores

- **Los cortes por el límite de uso del asistente** interrumpieron el trabajo al menos tres veces (21/10, 23/10 y 24/10; capítulo 3, §3.3) y dejaron informes a medias, como el de rendimiento 3D. La mitigación fue que cada agente escribiera su informe mientras trabajaba y que el siguiente partiera del disco.
- **Una interfaz sobrecargada.** La primera versión enseñaba todo a la vez: 16 cajas y 7 cifras grandes en la pantalla de inicio del particular, y una ficha de vehículo de 4,4 pantallas de alto en el ordenador (informe de UX del 23/10). Lo detectó el autor al usarla. La lección es que "funciona con datos reales" no es lo mismo que "se entiende", y que la revisión de usabilidad debe llegar antes.
- **Una prueba que no medía lo que parecía.** `light-imports.test.ts` garantiza que el código fuente del módulo 3D no importa three.js en su parte ligera, pero el empaquetado de producción lo sigue precargando en todas las pantallas (§7.6.4). El error está en la configuración de `manualChunks`, no en el código, y solo se ve midiendo el resultado del *build*.
- **Documentación de diseño desfasada.** Los documentos de diseño del 21/10 se escribieron antes que el código y describían servicios, nombres y bloqueos que la implementación cambió (§6.9). Se han corregido en esta memoria, pero la lección es que la documentación de diseño necesita una fecha y un estado ("diseño" o "verificado contra el código") para que nadie la tome por una descripción del sistema.
- **El entorno.** XAMPP en Windows obligó a adaptarse: PHP 8.2 fija Laravel 12; sin la extensión `intl`, el formato se hace en el cliente; y sin OPcache, cada petición tardaba unas diez veces más, lo que se resolvió con un script de arranque propio (`scripts/servidor-api.cmd`).

## 13.4 Limitaciones del sistema

Lo que CarCare **no** hace o **no** se ha comprobado, para que no se interprete lo contrario:

*Tabla 13.2. Limitaciones del sistema.*

| Limitación | Motivo o estado |
|------------|-----------------|
| Sin pruebas extremo a extremo, auditoría de accesibilidad, auditoría de seguridad ni integración continua | Pendientes (tareas 6, 7, 8 y 11) |
| Sin validación con usuarios | Pendiente (tarea 30). Las hipótesis de producto del capítulo 2 siguen siendo hipótesis |
| No está desplegado en ningún servidor | Decisión D14 pendiente (capítulo 9) |
| No emite facturas | Decisión D12 = A: emitirlas lo convertiría en un sistema de facturación sujeto al RD 1007/2023 |
| No mide el estado del vehículo | No hay sensores ni integraciones: el estado de las zonas sale de los intervalos que escribe el usuario |
| El correo de recuperación de contraseña se escribe en un registro local | Decisión D17 = A; para un servicio de correo real solo cambia la configuración |
| Sin verificación del email ni doble factor | Fuera de alcance (ADR‑0006) |
| Una sola moneda (euro) | La columna `currency` existe, pero no hay conversión |
| La numeración simultánea de órdenes no tiene prueba con dos procesos | SQLite, que usan las pruebas, ignora `FOR UPDATE` |
| El taller y el particular son mundos separados | Un coche del taller y el mismo coche en el garaje de su dueño son registros distintos (D13 pendiente) |

## 13.5 Trabajo futuro

Ordenado por lo que más acerca el producto a su hipótesis principal (capítulo 2, §2.4: "un solo producto para los dos lados del mostrador"):

1. **Solicitudes de reparación de un particular a un taller (E16).** Pedida por el autor el 24/10/2026; su diseño quedó fijado el 26/10 en ADR‑0007, pero no tiene código (tareas 32‑35): directorio de talleres, solicitud desde el espacio personal, presupuesto con versiones rotulado "no es una factura", conversión en orden y notificaciones en la aplicación. Es el primer puente real entre los dos modos, y abre de forma acotada el aislamiento entre espacios de ADR‑0002.
2. **Enlace del cliente para seguir su orden** sin crear cuenta (idea I7, D13‑B) y **vincular el coche del taller con el garaje del particular** con su consentimiento, de modo que la intervención entregada aparezca en su historial (I8, D13‑C). Requiere un ADR de privacidad.
3. **Avisos fuera de la aplicación**: correo para recordatorios y órdenes listas (I10), o un calendario ICS como alternativa barata (I11).
4. **Un uso del 3D con utilidad práctica**: una hoja de recepción en la que el taller marca golpes y daños sobre el coche 3D al recibirlo (I13). Responde al riesgo R20 ("que el 3D no aporte valor real").
5. **Producción**: despliegue (capítulo 9), copias de seguridad, servicio de correo real, verificación del email y doble factor, y política de privacidad antes de cualquier uso con datos reales.
6. **Portabilidad para el particular**: exportar todos sus datos (I16), igual que ya se ha diseñado para el cliente del taller (ADR‑0005).
7. **Aplicación instalable** con registro de repostajes sin conexión (I21).

El banco completo de ideas, con su valor y esfuerzo estimados, está en [`CarCare/04_ideas/banco-ideas.md`](../../../CarCare/04_ideas/banco-ideas.md).

## 13.6 Valoración personal

> [PENDIENTE: Alberto — este apartado lo escribe el autor con su propia valoración: qué ha aprendido, qué haría de otra forma y cómo ha sido dirigir el desarrollo con un asistente de IA. No lo redacta el asistente. ⚠️ Depende de Ilerna si la guía fija su extensión o si debe ir en este capítulo.]
