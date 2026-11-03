# Informe · frontend-react (particular) · E16: pantallas del particular y campana

| Campo | Valor |
|-------|-------|
| Fecha | 29/10/2026 (construcción) · 01/11 y 03/11/2026 (prueba contra la API y cierre) |
| Agente | frontend-react (particular) |
| Tarea | 34 de [`AUTOPILOTO.md`](../AUTOPILOTO.md) |
| Estado | **Hecha** (03/11): las historias E16‑2, 3, 7, 8, 9, 10 y 11 se han probado contra la API real a 360 y 1280 px. La verificación final (03/11, de 10:18 a 10:50) está en verde, también a 768 px |

## Objetivo

E16 ([ADR‑0007](../../arquitectura/ADR-0007-solicitudes-a-talleres.md), [contrato §3.13](../../api/contrato-v1.md#313-directorio-de-talleres-solicitudes-de-reparación-y-notificaciones)): un particular busca un taller, le pide una reparación, responde al presupuesto y sigue la orden. Además, la campana de avisos en la cabecera de los dos modos. Criterios E16‑2, 3, 7, 8, 9, 10 y 11 de las [historias](../../../CarCare/02_backlog/E16-solicitudes-a-talleres.md).

## Qué se hizo

### 1. Construcción (29‑31/10; commits ae3926b y 002e839)

- **Paso 0**, que desbloqueaba la tarea 35 (fila 24 del tablero):
  - claves en `api/keys.ts`;
  - `api/hooks/repairRequests.ts`, con las consultas de las dos partes, el directorio, las mutaciones del particular, `afterRepairRequestChange` y `refetchOnConflict`;
  - `api/hooks/notifications.ts`;
  - `features/requests/requestStatus.ts`, con los textos de §3.13.4 según la perspectiva y el consentimiento literal;
  - `QuoteCard`, de solo lectura y con el rótulo "Presupuesto (no es una factura)";
  - las rutas `talleres`, `solicitudes`, `solicitudes/nueva` y `solicitudes/:requestId`, con `ByWorkspaceType`, que elige la página según el tipo de espacio.
- **Pantallas:**
  - `DirectoryPage`: búsqueda y servicio en la URL, y tarjetas que solo muestran los datos que existen;
  - `NewRequestPage`: consentimiento literal de §3.13.7, casilla del historial desmarcada, 422 en cada campo, y 409 y 429 sin perder lo escrito;
  - `MyRequestsPage`: filtro "Abiertas" o "Todas";
  - `RequestDetailPage`: presupuesto, aceptar o rechazar, cancelar, interruptor del historial y "Ver lo que ve el taller", y seguimiento de la orden.
- **Campana** `components/layout/NotificationBell.tsx` en `AppShell` (los dos modos):
  - contador cada 60 s solo con la pestaña visible;
  - "9+" y `aria-label` con la cifra real;
  - "Ver más", marcar una o todas, y aviso nuevo por `role=status`;
  - textos en `lib/notifications.ts`, con tests.
- **Menú:** "Talleres" y "Solicitudes" en `nav.ts`. En el móvil van en la hoja "Más".
- **Vitest:** `requestStatus.test.ts` (estados según la perspectiva, consentimiento y redirección) y `lib/notifications.test.ts` ("9+", nombre accesible y destino).

### 2. Primera prueba contra la API (01/11; commit 636a206)

El agente del 01/11 montó el arnés de Playwright y corrigió lo siguiente:
- `Dialog`: el foco vuelve a quien abrió el diálogo;
- `RequestDetailPage` y `WorkshopRequestDetailPage` llevan al espacio correcto (`requestWorkspaceId`). Una misma persona puede ser particular y miembro de un taller, y abierta desde el espacio equivocado la pantalla le ofrecía las acciones de la otra parte;
- seguimiento: "No aplica" si la orden está cancelada, y ya no promete avisos que no van a llegar;
- `sharedHistoryFacts` sin etiquetas repetidas;
- `applyServerErrors` lleva el foco al primer campo con error del 422.

Las 7 capturas de esa prueba están en `2026-11-01-e16-capturas/`. Seis se regeneraron el 03/11 a las 01:45‑01:46 con las mismas escenas; solo `demo-mis-1280.png` es la original del 01/11. **He revisado las correcciones: están bien y no he cambiado ninguna.**

### 3. Cierre (03/11, esta ejecución)

Repetí todos los recorridos contra una instancia aislada y añadí los que faltaban: la campana (`04-campana.cjs`), los estados de carga, error y vacío (`05-estados.cjs`), el teclado (`07-teclado.cjs`) y los criterios sueltos (`08-extra.cjs`).

Fallos encontrados y corregidos en esta ejecución:

| # | Fallo | Arreglo | Archivo |
|---|-------|---------|---------|
| 1 | Con Tab, el foco llegaba al panel de la pestaña de la bandeja (Radix le pone `tabindex=0`) **sin anillo visible**: tenía `outline-none` | Quitado `outline-none`: se ve el anillo global. Solo lo usa la bandeja del taller | `components/ui/Tabs.tsx` |
| 2 | A 360 px, el selector "Tipo" de las líneas (presupuesto y orden) cortaba "Mano de obra": medía 140 px y hacen falta 154. La petición 21 solo lo arregló a 1280 | En el móvil, el tipo ocupa las dos columnas menos el hueco de la papelera: ahora mide 234 px y no se solapa con ella | `components/forms/LineItemsEditor.tsx` |
| 3 | Bandeja vacía de un taller que no sale en el directorio: durante un instante decía "Los particulares te encuentran en el directorio…", que es falso, antes de cambiar al texto correcto | Mantiene el esqueleto hasta tener el perfil | `features/workshop/requests/WorkshopRequestsPage.tsx` |

Los fallos 1 y 3 son del lado del taller y también salen en el [informe de la tarea 35](2026-10-29-frontend-react-e16-taller.md). En la verificación final se corrigió un cuarto fallo, también del taller: la bandeja vacía no debe decir que el taller sale en el directorio si su perfil no se ha podido cargar. Está en ese mismo informe, n.º 4.

## Evidencias

### Instancia y método

- **API:** `127.0.0.1:8050`, con OPcache. **Web:** Vite en `localhost:5183`, con `VITE_API_TARGET=http://127.0.0.1:8050`.
- **BD:** `carcare_front` en la MariaDB desechable de `:3399`. Ni `:8000`, ni `:5173`, ni el MySQL de `:3306` se han tocado.
- Antes de cada recorrido, `migrate:fresh --seed` en `carcare_front` (`reseed.sh`).
- **Navegador:** Chromium (Playwright) con `locale es-ES`, `Europe/Madrid` y `reducedMotion: reduce`.
- **Arnés,** fuera del repo, en `C:/Users/Alberto/AppData/Local/Temp/carcare-fe-e16/`. Sus registros están en `out/*.log`.

### Resultados del particular

| Script | Qué cubre | 1280 px | 360 px |
|--------|-----------|---------|--------|
| `02-particular.cjs` | E16‑2, 3, 7, 8, 9, 11, el 404 y el menú | **59 OK · 0 fallos** | **60 OK · 0 fallos**. Repetido el 03/11 a las 10:28, con los arreglos de `LineItemsEditor` y `Tabs`: **60 OK · 0 fallos** |
| `04-campana.cjs` | E16‑10, en el particular, el taller y el mecánico | **34 OK · 0 fallos** | **37 OK · 0 fallos**, con la medición del sondeo |
| `05-estados.cjs` | Carga, error con reintento y vacíos de las 8 pantallas E16 | **42 OK · 0 fallos** | **42 OK · 0 fallos**. Repetido el 03/11 a las 10:37: **42 OK · 0 fallos** |
| `07-teclado.cjs` | Tab con foco visible en 7 pantallas, diálogo con el foco atrapado y Esc | **9 OK · 0 fallos** | **9 OK · 0 fallos**. Repetido el 03/11 a las 10:29: **9 OK · 0 fallos** |
| `08-extra.cjs` | Avisos al enviar y al cancelar, y coche borrado | ver la sección de criterios sueltos | — |

**A 768 px** (verificación final del 03/11):
- `02-particular` da **59 OK · 0 fallos**, a las 10:47. A ese ancho, el menú va en la barra lateral, como a 1280.
- `07-teclado` da **9 OK · 0 fallos**, a las 10:49.
- En ninguno hay desbordes. El detalle está en el [informe de la tarea 35](2026-10-29-frontend-react-e16-taller.md#verificación-final).

### Por historia (lo comprobado en el navegador y en la API)

- **E16‑2 · Directorio:**
  - 4 talleres;
  - "lleida" ⇒ "Taller Demo" y "Talleres Ejemplo Norte", con "2 talleres coinciden";
  - un espacio final no lanza peticiones en bucle (0);
  - sin resultados: "No hay talleres con ese nombre o ciudad", y la búsqueda sigue editable;
  - filtro "Chapa y pintura" ⇒ "Carrocerías Ficticia";
  - el teléfono es un enlace `tel:`; si no hay teléfono, no se muestra ni se rellena;
  - siendo miembro del taller (`is_member`), no sale "Solicitar reparación" (en `03-taller`);
  - sin ningún taller publicado: "Todavía no hay talleres en el directorio".
- **E16‑3 · Nueva solicitud:**
  - el taller viene preseleccionado con `?taller=` y el coche con `?vehiculo=`;
  - el consentimiento es literal, con el nombre del taller, y cambia al cambiar de taller;
  - la casilla del historial es literal y está desmarcada;
  - validación en cliente junto a cada campo, con el foco en el primero que falla;
  - los km se rellenan con `current_mileage`;
  - **422 del servidor** en km: "No puede ser menor que el último kilometraje anotado (79.308 km)." El foco va a ese campo y queda a la vista;
  - **422** en el taller: "Este taller no está en el directorio.";
  - **409** literal: "Ya tienes una solicitud abierta para este vehículo en este taller.", y el formulario conserva lo escrito;
  - **429** literal de la 6.ª: "Has enviado 5 solicitudes en las últimas 24 horas. Vuelve a intentarlo mañana.", y el formulario conserva lo escrito;
  - al enviar, llega al detalle con "Enviada". En la API, `share_history=false`, los km y el teléfono quedan bien y **no se crea ninguna lectura de km**;
  - con `?taller=99999`: "Ese taller ya no está en el directorio. Elige otro de la lista.";
  - sin coches: "Primero añade tu coche" con "Añadir coche".
- **E16‑7 · Presupuesto:**
  - "Presupuesto (no es una factura)", líneas, "Válido hasta el 02/12/2026", 135,52 € con `Intl` y la nota;
  - al rechazarlo con motivo pasa a "Aceptada · presupuesto pendiente" y se ve tu motivo. Sin motivo también se puede (en `03-taller`);
  - "Aceptar" pide confirmación ("…abrirá una orden con estas líneas…") y después sale "En el taller · OT‑2026‑0035";
  - **409** "El taller ha enviado un presupuesto nuevo. Revísalo antes de responder.", y la pantalla se recarga con la v3 sin recargar la página;
  - caducado: "Caducado", sin "Aceptar", y se puede rechazar. Por la API, 409 "El presupuesto caducó el 25/10/2026…";
  - en la segunda conversión del mismo coche no se duplican ni el cliente ni el vehículo (SQL: 1 y 1).
- **E16‑8 · Seguimiento:**
  - número y estado de la orden ("Entregado" o "Listo", como en el tablero) y sus fechas;
  - **ningún enlace** a la orden, y la API da 404 en `/work-orders/{id}`;
  - al pasar la orden a "Listo" llega "Tu Seat Ibiza está listo en Taller Demo (OT‑2026‑0036)" y el contador sube en 1;
  - orden borrada por el taller: "El taller ha eliminado la orden".
- **E16‑9 · Historial:**
  - el interruptor está apagado si no se marcó;
  - "Ver lo que ve el taller" no enseña importes;
  - al retirarlo, la API da 403 y el enlace desaparece; al volver a darlo, 200;
  - en una solicitud cerrada (cancelada, rechazada o convertida) no hay interruptor.
- **E16‑10 · Campana:**
  - `aria-label` "Notificaciones, 27 sin leer" y contador "9+";
  - foco visible (anillo lima de 2 px); Enter abre, Tab entra en el panel y Esc cierra y devuelve el foco a la campana;
  - 20 avisos, y "Ver más" carga los 30;
  - pulsar un aviso lleva a `/app/1/solicitudes/3`, cierra el panel y lo marca como leído (en la API, −1);
  - "Marcar todas como leídas" deja el contador a 0 y la API también dice 0;
  - **sondeo medido a 360 px: 1 petición en 62 s con la pestaña visible, 0 en 125 s con la pestaña oculta y 1 al volver**;
  - un aviso nuevo se anuncia: "Tienes 1 notificación sin leer" (`role=status`);
  - el panel cabe a 360 px (x=12, ancho 336) y en el modo taller la campana está en la cabecera;
  - el mecánico no tiene contador y ve "No tienes avisos";
  - aviso de una solicitud borrada: "Esta solicitud ya no existe";
  - aviso sin solicitud: es un botón que lo marca como leído, no un enlace roto;
  - error del panel con "Reintentar"; la primera vez, esqueleto con "Cargando notificaciones…".
- **E16‑11 · Cancelar:**
  - pide confirmación; "Volver" cierra y devuelve el foco;
  - cancelada: sin el botón y sin el interruptor;
  - en una convertida no sale el botón, y por la API da 409 "Esta solicitud ya es la orden OT‑2026‑0034. Para cancelarla, llama al taller.";
  - el aviso al taller y el coche borrado: ver la sección de criterios sueltos.
- **Menú:** "Talleres" y "Solicitudes" en la barra de escritorio y en la hoja "Más" del móvil. Desde "Más", "Talleres" lleva al directorio.

### Común a todas las pantallas

- **Sin desbordes horizontales** a 360 ni a 1280 en ninguna auditoría (`overflow=0`), y sin `undefined`, `NaN`, `null` ni `[object Object]` en pantalla.
- **Consola:** solo aparecen los mensajes del propio navegador por las respuestas 4xx que se provocan a propósito: el 401 de `/me` antes de entrar y los 404, 409, 422 y 429 de los casos. **Ningún `pageerror`** ni error de React.
- **Carga, error y vacío** (`05-estados`), en el directorio, la nueva solicitud, mis solicitudes, el detalle, el historial compartido, la bandeja, el detalle del taller y el perfil del directorio:
  - esqueleto con "Cargando…" para el lector de pantalla;
  - error 500 con el mensaje de la API y "Reintentar", que vuelve a cargar los datos.
- **Toasts:** sonner con `aria-live=polite`.

### Capturas

Hay 12 en `2026-11-01-e16-capturas/`: las 7 del 01/11 y 5 nuevas del 03/11 (ver el informe de la tarea 35). El resto está en `out/` del arnés, fuera del repo. Del particular:
- `demo-mis-1280.png`;
- `demo-aceptar-presupuesto-1280.png`;
- nuevas: `campana-360.png` y `estado-error-1280.png` ("Mis solicitudes" con error y "Reintentar").

### Comandos (03/11)

Ver el final del [informe de la tarea 35](2026-10-29-frontend-react-e16-taller.md#verificación-final): `typecheck`, `lint`, `test` y `build` se ejecutaron una vez para las dos tareas.

## Limitaciones

- **Calendario del campo de fecha:** el 4.º Tab dentro de "Fecha preferida" cae en el botón del calendario nativo. Chromium le dibuja un recuadro tenue propio que no se puede estilar. Pasa en todos los campos de fecha de la app, no solo en E16. Los tres segmentos de la fecha sí tienen el anillo lima.
- **Hoja "Más" del móvil:** sus secciones son botones que navegan, no enlaces. Funcionan con teclado y lector de pantalla, pero no se pueden abrir en otra pestaña. Es código común anterior a E16 y no lo he cambiado.
- **Pestaña oculta:** se simuló redefiniendo `document.visibilityState` y lanzando `visibilitychange`, que es lo que lee TanStack Query. No se probó minimizando una ventana real.
- **Solo Chromium:** no se ha probado en Firefox ni en Safari, ni con un lector de pantalla real. Lo accesible se comprobó por roles, nombres, foco y regiones `aria-live`.
- El E2E de Playwright del repo (tarea 6, flujo completo E16) es de `qa-tester`. No lo he escrito, porque el arnés de este informe es desechable.

## Siguiente paso

- `qa-tester`: llevar al E2E del repo el flujo de las historias (solicitar ⇒ aceptar con presupuesto ⇒ aceptar ⇒ tablero ⇒ "Listo" ⇒ aviso). Los scripts de este arnés sirven de guía.
- Si Alberto lo quiere, cambiar la hoja "Más" del móvil a enlaces de verdad.
