# ADR‑0003 · Una intervención con coste genera un gasto vinculado

| Campo | Valor |
|-------|-------|
| Estado | Aceptada (21/10/2026) |
| Sustituye | D3 del plan inicial v1 (opción A) |

## Contexto
Si intervenciones y gastos se registran por separado, el usuario apunta dos veces y los totales pueden contar el mismo desembolso dos veces.

## Decisión
En espacios **personales**, al guardar una intervención con `total_cost > 0`, un servicio crea o actualiza en la **misma transacción** un gasto vinculado (`expenses.maintenance_record_id` único). Ese gasto no se edita ni borra desde Gastos (409). Archivar la intervención retira el gasto; restaurarla lo recrea. **Todos los totales salen solo de `expenses`.**

En **talleres** no se generan gastos: la cifra económica es la facturación de órdenes de trabajo entregadas.

## Consecuencias
- Un único origen para las sumas, comprobable con un test ("los totales no cuentan dos veces").
- La pantalla de Gastos muestra los vinculados como "desde intervención" con enlace.

## Cómo defenderlo
Integridad de datos: una sola fuente de verdad para importes y transacciones atómicas.
