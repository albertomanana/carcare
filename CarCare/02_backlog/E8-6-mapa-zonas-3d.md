# E8‑6 · Mapa de zonas del coche en 3D

| Campo | Valor |
|-------|-------|
| Épica | E8 · Recordatorios y mapa de zonas 3D |
| Prioridad | Must |
| Estado | Construido (23/10/2026: `frontend/src/components/vehicles/ZoneMap.tsx` con vista 3D/2D y rayos X "Ilustrativo", `frontend/src/three/index.tsx` (`CarViewer` y `ZoneMap2D`); API `GET /vehicles/{v}/zones`). Falta verificar la definición de terminado (teclado, lector de pantalla, 360 px): tareas 6 y 8 |
| Para | Particular y taller |
| Depende de | E8‑2 (estado de recordatorios), E3‑8 (zona de cada intervención), E14‑2 (coche 3D), E14‑6 (alternativa accesible), ADR‑0004, contrato §3.8 |

## Historia

Como **particular (o mecánico)** quiero **tocar una zona del coche en 3D (motor, frenos, neumáticos…) y ver su último trabajo, cuántos hay y su próximo aviso** para **entender de un vistazo qué toca revisar según mis propios intervalos, sin buscar en listas**.

## Criterios de aceptación

- [ ] Dado un vehículo, cuando abro la vista "Inspeccionar", entonces veo **10 marcadores** (Motor, Transmisión, Frenos, Neumáticos, Suspensión y dirección, Eléctrico y batería, Carrocería, Interior y climatización, Escape, General) colocados sobre la carrocería que corresponde. Siempre los 10 y en el orden del enum, aunque no haya datos.
- [ ] Dado un recordatorio de frenos vencido y otro próximo, cuando veo la zona Frenos, entonces su estado es **vencido** (gana el peor: vencido > próximo > al día > sin datos), con **color + icono + texto**, nunca solo color.
- [ ] Dada una zona sin recordatorios pero con intervenciones, cuando la veo, entonces su estado es "sin datos" con `basis = records`, y el panel dice "Hay historial, pero no tienes recordatorios para esta zona" con el botón "Crear recordatorio" (zona ya elegida).
- [ ] Dada una zona sin nada, cuando la selecciono, entonces el panel dice "Sin datos" (`basis = none`) y ofrece "Registrar intervención" y "Crear recordatorio".
- [ ] Dada una zona con datos, cuando la selecciono (clic, toque o Enter), entonces la cámara se desplaza suavemente hacia ella (sin vuelo con `prefers-reduced-motion`), la pieza se resalta y el panel muestra: última intervención (título, fecha, km, enlace), nº de intervenciones, próximo recordatorio (fecha y/o km restantes, barra de progreso).
- [ ] Dado cualquier estado mostrado, cuando lo leo, entonces aparece siempre la leyenda **"según tus intervalos, no medido"**. No aparece ninguna palabra como "salud", "desgaste" ni "diagnóstico".
- [ ] Dado un teclado, cuando navego con Tab, entonces cada marcador es un **botón HTML** con nombre accesible ("Frenos: vencido"), con foco visible, y Esc cierra el panel.
- [ ] Dado un navegador sin WebGL (o la preferencia "vista 2D"), cuando abro la vista, entonces veo una **lista HTML de las 10 zonas** con el mismo estado y el mismo panel, sobre la silueta 2D.
- [ ] Dado un `mechanic` en un taller, cuando abre la vista, entonces ve lo mismo (permiso `view`); las acciones de crear dependen de `operate`.

## Datos y reglas

- Endpoint: `GET /api/v1/vehicles/{v}/zones` → `{ data: ZoneStatus[] }` (contrato §3.8, tipo `ZoneStatus`).
- Tablas: `reminders` (pendientes, por `zone`), `maintenance_records` (no archivadas, por `zone`).
- El estado no se guarda: se calcula al serializar.
- Autorización: `view` del espacio del vehículo. Vehículo de otro espacio ⇒ `404`.

## Pantallas implicadas

Ficha del vehículo (pestaña "Inspeccionar") y dashboard del particular (acceso desde el coche protagonista).

## Pruebas previstas

- Backend: un test por regla de estado (peor estado gana, `records`, `none`), siempre 10 zonas, aislamiento `404`.
- Frontend: panel con los tres `basis`; leyenda presente; lista HTML equivalente; navegación por teclado.
- E2E: crear un recordatorio de frenos vencido → la zona Frenos aparece "vencido" en la vista 3D y en la lista.

## Fuera de alcance / limitaciones conocidas

- No hay datos medidos (OBD, sensores): el estado depende **solo** de los recordatorios que define el usuario.
- La posición de los marcadores es aproximada por carrocería, no por modelo concreto.
