# Banco de ideas

*Apunta aquí cualquier idea en una línea, sin filtrar. Una vez por sprint (u oleada) se revisan: las buenas pasan a `_plantilla-idea.md` o directamente al backlog. Última revisión: 21/10/2026 (agente producto).*

**Valor** y **esfuerzo**: Alto / Medio / Bajo (estimaciones del agente producto, sin validar). **Requiere datos externos**: "sí" si necesita OBD, telemática, APIs de terceros, servicios de pago o datos oficiales.

| # | Idea | Para quién | Valor | Esfuerzo | ¿Requiere datos externos? | Estado |
|---|------|-----------|-------|----------|---------------------------|--------|
| I1 | Estado de mantenimiento según los intervalos que define el usuario ("según tus intervalos, no medido") | Todos | Alto | Medio | No | **En curso** → E8‑2 y mapa de zonas E8‑6 |
| I2 | Exportar el historial del coche para venderlo | Quien vende su coche | Alto | Medio | No | **En curso parcial** → E10‑1 (informe); PDF en E10‑2. Ojo: Drivvo ya transfiere el historial al comprador |
| I3 | Extracción asistida de datos de facturas (OCR/IA) con revisión humana | Todos | Alto | Alto | Servicio de IA u OCR (o OCR local, p. ej. Tesseract: viabilidad sin verificar) | Fase 3. Fuelio Pro ya escanea tickets sin conexión (ver competencia) |
| I4 | Asistente que responde con los datos guardados | Todos | Medio | Alto | Servicio de IA | Fase 3 |
| I5 | Consumo medio a partir de repostajes con litros | Particular | Medio | Bajo | No | **En curso** → E7‑3 (método lleno‑a‑lleno) |
| I6 | Lectura OBD‑II | Usuarios avanzados | Por validar | Alto | Sí | Solo investigar |
| I7 | **Enlace del cliente del taller** para ver el estado de su orden (recibido → listo) sin crear cuenta | Taller → su cliente | Alto | Medio | No (email o SMS para enviarlo, sí) | Por decidir (D13‑B). Programa Taller ya lo tiene: es necesario, no diferencial |
| I8 | **Vincular el coche del taller con el garaje del particular** (con consentimiento): al entregar la orden, la intervención aparece en su historial | Ambos | Alto (diferencial) | Alto | No | Por decidir (D13‑C). Necesita ADR (privacidad, RGPD) |
| I9 | **Compartir mi historial con un taller** o con un comprador: acceso de solo lectura temporal y revocable | Particular | Medio | Medio | No | Por evaluar → E10‑3 |
| I10 | **Avisos por email**: recordatorio próximo o vencido, orden lista para recoger, invitación al equipo | Ambos | Alto | Medio | Servicio de correo (SMTP) + tareas programadas | Fase 2 → E8‑8, E13‑8, E1‑6 |
| I11 | Calendario ICS de recordatorios (suscribirse desde Google o Apple Calendar) | Ambos | Medio | Bajo | No | Por evaluar: alternativa barata a los avisos por email |
| I12 | Presupuesto con **aprobación del cliente online** (acepta o rechaza, con fecha) | Taller | Alto | Medio | No | Fase 2 → E12‑10. Tekmetric, Shopmonkey y Garage Hive lo tienen |
| I13 | **Hoja de recepción 3D**: marcar golpes y daños sobre el coche 3D al recibirlo, con foto por zona | Taller (y particular al comprar o alquilar) | Medio‑Alto | Alto | No | Por evaluar: **un uso del 3D con utilidad real**, no solo estética |
| I14 | Plantillas de recordatorios habituales con valores de ejemplo editables (nunca "del fabricante") | Particular | Medio | Bajo | No (con intervalos del fabricante sí: datos con licencia) | Por evaluar → E8‑7 |
| I15 | Importar CSV de Drivvo o Fuelio para migrar sin perder datos | Particular | Medio | Medio | No (formatos de exportación de terceros: sin verificar) | Por evaluar |
| I16 | Exportar todos mis datos (portabilidad RGPD) | Ambos | Medio | Bajo | No | Por evaluar → E10‑4 |
| I17 | Crear un recordatorio desde la caducidad de un documento (póliza, tarjeta ITV) | Particular | Medio | Bajo | No | Por evaluar → E9‑4 |
| I18 | Garaje familiar: compartir el espacio personal con otra persona (pareja, hijos) | Particular | Medio | Medio | No | Por evaluar. Choca con el contrato v1 (en `personal` solo hay owner): necesitaría un cambio de ADR‑0002 |
| I19 | Modo pantalla grande (TV del taller) con el taller 3D y el tablero en solo lectura | Taller | Medio | Bajo | No | Por evaluar |
| I20 | Enlace a miDGT junto a los recordatorios de ITV y seguro ("consulta el dato oficial") | Particular | Bajo | Bajo | No (solo un enlace, sin integración) | Por evaluar: honestidad frente a miDGT |
| I21 | PWA instalable y registro de repostaje sin conexión que se sincroniza después | Particular | Medio | Medio | No | Por evaluar |
| I22 | Cronómetro de horas por mecánico y orden | Taller | Medio | Medio | No | Por evaluar. Lo tienen Tekmetric y Shopmonkey |
| I23 | Avisos al cliente del taller por SMS o WhatsApp | Taller | Alto | Alto | Sí (proveedor de pago) | Solo investigar. Programa Taller lo cobra aparte |
| I24 | Precios de combustible cercanos | Particular | Medio | Alto | Sí (fuente de datos de precios: sin verificar) | Solo investigar. Drivvo y Fuelio ya lo tienen: no diferencial |
| I25 | Sondeo periódico o tiempo real en el tablero kanban (varios puestos a la vez) | Taller | Medio | Medio | No | Por evaluar si las pruebas con talleres lo piden (E12‑2) |

## Preguntas abiertas

- ¿Qué haría que un particular abriera la app cada semana y no solo cuando va al taller? (¿el repostaje rápido? ¿el diario?)
- ¿Qué parte pagaría un particular? Los competidores cobran entre 0 y 50 €/año: ¿merece la pena cobrarle?
- ¿Un taller usaría CarCare **junto a** su programa de facturación, o solo si lo sustituye?
- ¿El 3D ayuda a encontrar la información o solo impresiona? (medir en las pruebas: R20)
- ¿Los clientes del taller aceptarían que su historial pase a su garaje personal? ¿Y el taller querría dárselo (miedo a perder al cliente)?
