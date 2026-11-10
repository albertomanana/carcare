# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos públicos con la misma prioridad (confirmado por Alberto, 10/11/2026), sobre una misma base y un mismo lenguaje visual:

- **Particular** (espacio `personal`): la persona que tiene uno o varios vehículos y quiere saber qué le toca, cuánto le cuesta y qué le ha hecho. Lo consulta en momentos cortos: al repostar, al volver del taller, cuando llega una ITV o un seguro.
- **Taller / flota** (espacio `workshop`): propietario, gerente y mecánicos de un taller pequeño. Gestionan clientes, vehículos, órdenes de trabajo en kanban, elevadores y equipo durante la jornada.

El proyecto se enseña sobre todo en **portátil o PC** (defensa del TFG de DAW, Ilerna); el móvil debe funcionar bien, pero no es la pantalla principal.

## Product Purpose

Gestionar la vida de un vehículo: kilometraje con control de retrocesos, repostajes y gastos, intervenciones, recordatorios por fecha o por km, documentos, analítica e informe exportable; y, para el taller, el ciclo de la orden de trabajo de la entrada a la entrega. Éxito: que el usuario sepa en segundos qué le toca y por qué, sin cifras inventadas.

## Positioning

Cada vehículo se representa con un **coche 3D procedural propio** según su carrocería y color, sobre el que se ven las zonas y su estado *«según tus intervalos, no medido»*; el taller tiene su nave 3D con elevadores. Particular y taller comparten base: un particular puede pedir una reparación a un taller desde la app (E16). Nada de diagnósticos, «health score» ni integraciones que no existen.

## Operating Context

SPA React 19 + TypeScript + Vite 8 + Tailwind 4 contra una API Laravel 12. Datos de demostración en el seeder (`demo@carcare.test`, `taller@carcare.test`, contraseña `password`). Catálogo marca → modelo → versión (EPA + lista editorial) y logotipos de marca (simple-icons, pendiente de decisión en la pregunta 4 del tablero). Interfaz y documentación en español.

## Capabilities and Constraints

- Contrato de API fijo en `frontend/src/api/types.ts`; el frontend no inventa campos.
- three.js se carga de forma diferida; un solo `<Canvas>` por pantalla; listados con miniaturas estáticas, nunca un WebGL por tarjeta.
- El 3D siempre tiene alternativa 2D (silueta SVG) y su información existe en HTML accesible.
- Modelo 3D procedural propio, sin marcas ni modelos con licencia (ADR-0004).
- Dinero como string DECIMAL; formateo de números y fechas en el frontend con `Intl` (es-ES).
- Ningún botón decorativo; si falta un dato se dice y se ofrece la acción que lo resuelve.
- Roles owner / manager / mechanic; la autorización vive en el servidor.

## Brand Commitments

- Solo se conserva el **nombre «CarCare»**. Logotipo, colores, tipografía y estilo pueden sustituirse (Alberto, 10/11/2026).
- Voz: español claro y cercano, sin tecnicismos innecesarios ni promesas.

## Evidence on Hand

- Datos demo del seeder (vehículos, gastos, intervenciones, órdenes, clientes inventados con `@ejemplo.test`).
- Catálogo de vehículos (`frontend/src/data/catalogo-vehiculos.json`) y 42 logotipos de marca (`frontend/public/img/marcas/`).
- No hay testimonios, clientes reales, precios ni métricas de uso: no se deben inventar.

## Product Principles

1. Ninguna cifra ni función sin fuente real; lo que falta se dice y se resuelve con una acción.
2. El coche es el centro: cada vehículo se reconoce por su forma 3D y su estado, no por una tabla.
3. Lo urgente primero: lo vencido y lo próximo antes que el historial.
4. Una base, dos oficios: particular y taller comparten lenguaje, cada uno con su densidad.
5. El 3D suma, nunca bloquea: siempre hay alternativa 2D y HTML accesible.

## Accessibility & Inclusion

WCAG 2.2 AA: teclado completo, foco visible, contraste AA, `prefers-reduced-motion`, responsive a 360, 768 y 1280 px.
