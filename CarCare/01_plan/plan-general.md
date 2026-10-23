# Plan general

*Última revisión: 21/10/2026 (agente producto) · Fuentes: plan inicial v1 (20/10/2026), petición de Alberto del 21/10/2026 (particular + taller + 3D), ADR 0001‑0004 y contrato de API v1.*

> **Aviso de alcance.** El 21/10/2026 el alcance creció mucho respecto al plan inicial: se añadió el modo taller (antes "fuera del MVP") y una interfaz 3D muy interactiva. El plan inicial tenía 12 pantallas y el contrato v1 implica más del doble (estimación del agente producto: unas 30, contando las de taller, el diario, los recordatorios, los documentos, el informe y las vistas 3D). **Sin calendario (D6) no se sabe si cabe.** Si no cabe, el plan de recorte está en D9 (`03_decisiones/registro-decisiones.md`).

## 1. Visión en una frase

> **El centro de control del coche, en 3D y con datos reales:** el particular sigue su coche día a día (km, repostajes, gastos, intervenciones, avisos) y el taller gestiona clientes, flota y órdenes con su equipo, todo en el mismo producto.

Tagline heredada (provisional): *"Your car. Your data. Your control."*

## 2. Público y problema

### Segmento 1 · Particular (espacio `personal`)
- **Quién:** propietarios de uno o varios coches, sobre todo usados o con varios años, que quieren controlar gasto, mantenimiento y papeles.
- **Problema** (de la documentación original, pendiente de confirmar con usuarios): la información está repartida entre facturas en papel, PDFs, mensajes y la memoria. No saben cuánto les cuesta el coche, olvidan vencimientos y no tienen un historial ordenado para vender.
- **Cómo lo resuelven hoy:** papel, Excel, apps como Drivvo, Fuelio, Simply Auto o AUTODOC CLUB, y miDGT para ITV y seguro (ver `06_investigacion/competencia.md`).
- **Hipótesis a validar** (no son hechos):
  - H‑P1: un particular registra un repostaje en menos de 30 s desde el móvil si el acceso está a un toque.
  - H‑P2: ver el coche en 3D con sus zonas le ayuda a entender qué toca revisar mejor que una lista, o al menos le motiva a volver.
  - H‑P3: el informe exportable tiene valor real al vender el coche.

### Segmento 2 · Taller / flota (espacio `workshop`)
- **Quién:** talleres independientes pequeños (1‑12 elevadores) con dueño, encargado y mecánicos. Por extensión, pequeñas flotas.
- **Problema** (hipótesis, sin validar): seguir qué coche está en qué fase y en qué elevador, quién lo lleva, qué se prometió al cliente y el historial de cada vehículo.
- **Cómo lo resuelven hoy:** pizarra o papel, y software de gestión de taller, muy abundante en España: desde 10 €/mes (TallerMatic) hasta 79‑129 €/mes (Programa Taller), con facturación VERI\*FACTU incluida (ver `06_investigacion/competencia.md`).
- **Hipótesis a validar:**
  - H‑T1: un tablero kanban con elevadores (2D o 3D) es más rápido de entender que su método actual.
  - H‑T2: el taller valora que el trabajo entregado quede en el historial del coche y, más adelante, llegue al cliente (D13).
  - H‑T3: un taller probaría CarCare **sin** facturación legal si convive con su programa de facturación actual.

## 3. Objetivos

| Tipo | Objetivo | Cómo sabré que lo he cumplido |
|------|----------|-------------------------------|
| Académico | Aprobar y defender el TFG de DAW | ⚠️ *Depende de Ilerna* (D1: rúbrica, extensión, fechas) |
| Producto | Núcleo del contrato v1 funcionando con datos reales en los dos modos | Historias del **núcleo defendible** (backlog) en `Hecho` con evidencias |
| Experiencia | 3D útil, accesible y fluido | E14‑6 y E14‑7 cumplidos: alternativa HTML, sin WebGL ⇒ silueta, objetivo de fps medido en el equipo de referencia |
| Calidad | Sin fugas entre espacios ni permisos mal aplicados | Test de aislamiento por endpoint y por rol (E1‑5, E13‑4) + auditoría de seguridad (E6‑5) |
| Validación | Probarlo con usuarios reales de ambos segmentos | 3‑5 particulares y 2‑3 talleres con el [guion](../06_investigacion/guion-prueba-usuarios.md); resultados reales anotados |
| Comercial | Saber si alguien pagaría y quién | Respuestas a las preguntas de pago del guion; decisión D10 informada. Nada de pagos en el TFG |

## 4. Alcance

### Dentro ahora (contrato v1, oleada 1 en curso)
- **Común:** registro como particular o como taller, sesión segura, perfil, baja · espacios de trabajo y cambio entre ellos · garaje con varios vehículos, archivar y restaurar · intervenciones con zona, tipo de servicio y líneas · kilometraje con control de retrocesos · recordatorios por fecha y/o km con recurrencia · **mapa de zonas 3D** ("según tus intervalos, no medido") · documentos privados · actividad.
- **Particular:** gastos con gasto vinculado (ADR‑0003) · repostajes y **consumo lleno‑a‑lleno** · **diario día a día** · coste/km solo con datos suficientes · dashboard y analítica · informe del vehículo.
- **Taller:** clientes · **órdenes de trabajo** con numeración, líneas, IVA y totales · **tablero kanban** · elevadores sin conflictos · entrega ⇒ intervención en el historial · equipo con roles owner/manager/mechanic · dashboard y analítica del taller (el mecánico no ve importes).
- **3D:** coche procedural por carrocería y color, rayos X ilustrativo, **taller 3D con elevadores**, portada 3D, miniaturas estáticas, silueta 2D de respaldo.

### Fase 2 (después de cerrar y validar el núcleo)
Recuperar la contraseña por email · avisos por email (recordatorios, orden lista) · invitaciones por email al equipo · informe en PDF y enlace temporal para compartirlo · enlace para que el cliente del taller vea su orden (D13‑B) · presupuesto con aprobación del cliente · plantillas de recordatorios editables · exportar mis datos (RGPD) · RGPD del cliente del taller · modo claro · PWA.

### Fase 3
Vincular el coche del taller con el garaje del cliente (D13‑C, necesita ADR) · extracción asistida de facturas con revisión humana (OCR/IA) · asistente sobre los datos guardados · hoja de recepción con daños marcados sobre el coche 3D (idea I13).

### Solo investigar (sin prometer)
OBD‑II · consulta de matrícula o VIN con proveedores autorizados · datos oficiales de la DGT (miDGT no ofrece una integración pública conocida: sin verificar) · precios de combustible · SMS y WhatsApp a clientes · **facturación legal VERI\*FACTU** (D12) · integraciones con peritación y recambios (GT Motive, Audatex…) · cobros y suscripciones (D10, D11).

### Fuera
Puntuación de conducción, "salud" o desgaste "medido" de piezas, niveles de fluidos, presión de neumáticos, viajes por GPS, tienda, mapas, control remoto del coche: requieren sensores o integraciones que no existen. Modelos 3D o logotipos de marcas reales.

## 5. Arquitectura (decidida)

| Tema | Decisión | Documento |
|------|----------|-----------|
| Forma de la app | API REST Laravel 12 + SPA React 19 en un monorepo, Sanctum en modo SPA | [ADR‑0001](../../docs/arquitectura/ADR-0001-api-rest-y-spa.md) |
| Particular + taller | Espacios de trabajo `personal`/`workshop` con roles owner/manager/mechanic | [ADR‑0002](../../docs/arquitectura/ADR-0002-espacios-de-trabajo.md) |
| Gastos e intervenciones | Intervención con coste ⇒ gasto vinculado (solo personal) | [ADR‑0003](../../docs/arquitectura/ADR-0003-gasto-vinculado.md) |
| Imagen del vehículo | Coche 3D procedural + silueta SVG de respaldo | [ADR‑0004](../../docs/arquitectura/ADR-0004-vehiculo-3d-procedural.md) |
| Contrato | Endpoints, permisos y reglas | [contrato‑v1](../../docs/api/contrato-v1.md) · tipos en `frontend/src/api/types.ts` |

**Stack** (versiones en `frontend/package.json` y `backend/composer.json` a 21/10/2026): Laravel 12 sobre PHP 8.2 (XAMPP) y MariaDB 10.4 · React 19.3, TypeScript 6.0, Vite 8.3, Tailwind 4.3, React Router 8.5, TanStack Query 5, Recharts 3, Motion 14, three 0.186, React Three Fiber 9.8, drei 10.7 · Node 25.6.

⚠️ **Soporte de versiones** (fuente: endoflife.date, consultado el 21/10/2026): Node 25 está **sin soporte de seguridad desde el 01/06/2026**. PHP 8.2 lo pierde el 31/12/2026 y Laravel 12 el 24/02/2027. Ver R14 y D15.

## 6. Sistema visual (resumen)

- Fondo carbón `#111518`, superficies `#1A2024` / `#20272B`, texto `#F5F7F7`, blanco cálido `#F2EFE8`, acento lima `#C7F36B`.
- Inter para la UI con cifras tabulares; display Space Grotesk o Manrope.
- La lima es acento, no relleno: una acción primaria por pantalla. El estado nunca se comunica solo por color.
- El 3D tiene el mismo tono premium y sobrio: estilizado, no fotográfico. Nunca muestra un dato que no exista.

## 7. Próximos pasos

- [ ] **Alberto:** responder D6 (calendario) y D1 (guía de Ilerna); con ellas, D9 (recorte).
- [ ] **Alberto:** decidir D15 (Node 25 sin soporte; PHP 8.2 y Laravel 12 pronto).
- [ ] **Alberto:** crear el remoto en GitHub privado y hacer el primer commit al cerrar la oleada 1 (D5).
- [ ] **Equipo:** cerrar la oleada 1 con informes y evidencias → oleada 2 (integración).
- [ ] **Producto:** buscar participantes para las pruebas (3‑5 particulares, 2‑3 talleres) **ya**, porque reclutar talleres lleva tiempo (R16).
- [ ] **Producto + arquitecto:** cambiar "facturación" por "importe de órdenes entregadas" en los textos visibles mientras D12 siga abierta.
