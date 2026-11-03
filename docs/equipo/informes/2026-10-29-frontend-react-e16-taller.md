# Informe · frontend-react (taller) · E16: pantallas del taller (tarea 35)

| Campo | Valor |
|-------|-------|
| Fecha | 29/10/2026 (construcción) · 01/11 y 03/11/2026 (prueba contra la API y cierre) |
| Agente | frontend-react (taller) |
| Tarea | 35 de [`AUTOPILOTO.md`](../AUTOPILOTO.md) |
| Estado | **Hecha** (03/11): E16‑1, 4, 5 y 6 probadas contra la API real con `taller@`, `gerente@`, `mecanico@` y un tercero, a 1280 y 360 px. Verificación final del 03/11, de 10:18 a 10:50, con el código del árbol de trabajo y también a 768 px: todo en verde (ver [Verificación final](#verificación-final)) |

## Objetivo

Las pantallas del taller para las solicitudes de reparación (E16‑1, 4, 5 y 6), según [ADR‑0007](../../arquitectura/ADR-0007-solicitudes-a-talleres.md) y el [contrato §3.13](../../api/contrato-v1.md#313-directorio-de-talleres-solicitudes-de-reparación-y-notificaciones). El mecánico no ve los botones de decidir.

## Qué se hizo

### 1. Construcción (29‑31/10; commits ae3926b y 002e839)

- **`features/workshop/requests/WorkshopRequestsPage.tsx`:** la bandeja.
  - Pestañas Nuevas (`pending`), Abiertas (`open`) y Todas, guardadas en `?ver=`. Solo se pide la pestaña visible y el contador de nuevas.
  - Filas enlazadas, con una píldora solo cuando le toca actuar al taller.
  - Vacío con salida a "Todas". Si el taller no sale en el directorio, lo dice, y el owner tiene el enlace "Aparecer en el directorio".
- **`WorkshopRequestDetailPage.tsx`:** el detalle.
  - El coche, con la silueta `VehicleThumb` de la copia fija, y sus datos: marca, modelo, año, combustible, carrocería, color y matrícula. Nunca el apodo ni el VIN.
  - Los km declarados, el asunto, la descripción, la zona y la fecha preferida.
  - El contacto (nombre, `mailto:` y `tel:`) y el historial compartido, sin importes. Si el cliente no lo comparte, "El cliente no comparte su historial." y **no se pide**, así que no sale ningún 403.
  - Los botones de decidir, solo con `can('manage')`.
  - Cuando ya es una orden, el enlace "Ver la orden OT‑…". Si el taller la borró, "ha eliminado la orden".
- **`components/DecisionDialogs.tsx`:**
  - "Aceptar", con sus dos caminos: "Aceptar y enviar presupuesto ahora" y "Aceptar, el presupuesto irá después";
  - "Rechazar", con un motivo obligatorio de 5 a 500 caracteres;
  - "Enviar presupuesto" y "Enviar otra versión", que parten de la versión vigente o de la rechazada.
- **`components/QuoteEditor.tsx` y `quoteForm.ts`:**
  - líneas con `LineItemsEditor` (precio obligatorio);
  - IVA del taller por defecto, validez de 15 días por defecto (de 1 a 90) y nota;
  - totales al escribir, con céntimos enteros y redondeo *half‑up*, aunque la cifra que vale es la de la API;
  - el 422 de `quote.items.N.*` o `items.N.*` va al campo que falla.
- **`api/hooks/workshopRequests.ts`:** aceptar, rechazar, enviar presupuesto, guardar el perfil y el contador. Invalidan con `afterRepairRequestChange`, y con un 409 vuelven a pedir los datos con `refetchOnConflict`.
- **`features/settings/DirectoryProfileCard.tsx`,** en Ajustes:
  - un bloque por taller;
  - editable por el owner y de solo lectura para el resto, sin "Guardar" y con "Solo el propietario del taller puede cambiarlo";
  - la ciudad es obligatoria si sale en el directorio, y el 422 va a su campo.
- "Solicitudes" en el menú del taller (`nav.ts`).
- **Vitest:** `quoteForm.test.ts`, con los cálculos del editor, el redondeo, la coma decimal y la entrada que se envía.

### 2. Primera prueba contra la API (01/11; commit 636a206)

- `Dialog`: el foco vuelve a quien abrió el diálogo.
- La solicitud abierta desde el espacio equivocado lleva al espacio correcto (`requestWorkspaceId`).
- **Petición 21:** la columna "Tipo" de `LineItemsEditor` pasa a 148 px a 1280.
- **Petición 22:** `transition-[background-color]` en las filas con enlace estirado, para que el anillo de foco no aparezca en blanco.

He revisado esas correcciones contra la API y están bien.

### 3. Cierre (03/11, esta ejecución)

**La duda del 01/11, resuelta: la orden a la que lleva una solicitud convertida carga bien.** Tarda de 388 a 502 ms en tener las líneas a la vista; se midió con `waitForFunction` sobre el valor de los campos. El "esqueleto de más de 15 s" era del arnés, por dos motivos:
- `settle()` comprobaba que no hubiera esqueleto antes de que React montara la ruta *lazy*, cuando todavía no había ninguno;
- las líneas de la orden son `<input>`, y `innerText` no incluye su valor.

Corregí el arnés (`settle` espera al `h1` de la página) y la comprobación ya pasa. El mismo error del arnés explicaba el "Caducado" que fallaba en el lado del particular.

Fallos de la app encontrados y corregidos:

| # | Fallo | Arreglo | Archivo |
|---|-------|---------|---------|
| 1 | Bandeja vacía de un taller que no sale en el directorio: hasta que llegaba el perfil decía "Los particulares te encuentran en el directorio…", que en ese caso es falso | Mantiene el esqueleto hasta tener el perfil | `features/workshop/requests/WorkshopRequestsPage.tsx` |
| 2 | Con Tab, el panel de la pestaña de la bandeja recibía el foco (Radix le pone `tabindex=0`) **sin anillo visible**, por `outline-none` | Quitado `outline-none`: se aplica el anillo global. Solo lo usa la bandeja | `components/ui/Tabs.tsx` |
| 3 | A 360 px, el selector "Tipo" del editor de líneas cortaba "Mano de obra": medía 140 px y hacían falta 154. Pasaba en el presupuesto y en la orden; la petición 21 solo lo arregló a 1280 | En el móvil, el tipo ocupa las dos columnas menos el hueco de la papelera, que se ajusta a su tamaño (`justify-self-end`). Ahora mide 234 px en el diálogo y 244 en la orden, sin solaparse con la papelera | `components/forms/LineItemsEditor.tsx` |
| 4 | Bandeja vacía cuando **falla** la petición del perfil del directorio. El arreglo 1 solo cubría la espera: con el perfil en error, `data` queda vacío y volvía el texto "Los particulares te encuentran en el directorio…" sin saber si es verdad. Lo encontré al revisar el código en la verificación final (03/11 10:32) | Solo dice "te encuentran" si la API confirma `listed: true`. Si el perfil no se pudo cargar, texto neutro ("Cuando un particular te envíe una solicitud de reparación, la verás en esta lista."), con la salida a "Todas" y sin "Aparecer en el directorio". Probado con un 500 simulado del perfil (`09-perfil-error.cjs`, 4 OK a 360 y a 1280) y repitiendo `03-taller` y `05-estados` a 360 | `features/workshop/requests/WorkshopRequestsPage.tsx` |

## Evidencias

**Instancia aislada:**
- API en `127.0.0.1:8050`, con OPcache;
- web en `localhost:5183`;
- BD `carcare_front` en la MariaDB desechable de `:3399`, con `migrate:fresh --seed` antes de cada recorrido.

Ni `:8000`, ni `:5173`, ni `:3306` se han tocado. El arnés está fuera del repo, en `C:/Users/Alberto/AppData/Local/Temp/carcare-fe-e16/`, y sus registros en `out/*.log`.

| Script | Cuentas | 1280 px | 360 px |
|--------|---------|---------|--------|
| `03-taller.cjs` (recorrido cruzado) | `taller@`, `gerente@`, `mecanico@`, `taller3@` (tercero) y `demo@` | **116 OK · 0 fallos** (03/11 02:20, y en la verificación final a las 10:24). Un primer intento a las 10:21 se cortó tras 55 OK por un fallo del entorno (ver las limitaciones) | **116 OK · 0 fallos** (03/11 10:18, con los arreglos 1‑3, y 10:35, con el 4). Antes de los arreglos dio 115 OK · 1 fallo, el n.º 3 de la tabla. Ahora el selector "Tipo" mide 234 px y hacen falta 154 |
| `05-estados.cjs` (parte del taller) | `taller@` | bandeja, detalle, historial y perfil del directorio: carga, error y reintento OK | ídem. A 360 se repitió entero el 03/11 a las 10:37, con el arreglo 4: **42 OK · 0 fallos** |
| `07-teclado.cjs` | `taller@` | bandeja, detalle, Ajustes y diálogo "Aceptar": foco visible, foco atrapado y Esc ⇒ "Aceptar" | ídem. A 360 se repitió el 03/11 a las 10:29, con el arreglo de `Tabs`: **9 OK · 0 fallos** |
| `04-campana.cjs` (parte del taller) | `taller@` y `mecanico@` | campana del modo taller, aviso ⇒ `/app/3/solicitudes/4`; el mecánico, sin avisos | ídem |
| `09-perfil-error.cjs` (arreglo 4) | `taller3@` | **4 OK · 0 fallos**: con el perfil listado, "te encuentran"; con el perfil en 500, texto neutro, salida a "Todas" y sin "Aparecer en el directorio" | **4 OK · 0 fallos** |

### Por historia

- **E16‑1 · Perfil del directorio** (`03-taller`):
  - owner: formulario editable;
  - listado y sin ciudad: error en el campo en el cliente, y la API da 422 `errors.city` "Indica la ciudad para aparecer en el directorio.";
  - teléfono inválido: error junto al campo;
  - al guardar sale el toast y **el particular ve el teléfono, el horario y "Chapa y pintura" en el directorio**;
  - al quitarlo del directorio desaparece; al volver a ponerlo, vuelve;
  - un taller nuevo, nunca configurado: interruptor apagado, campos vacíos, 8 casillas sin marcar y "Todavía no lo has guardado nunca". Con el interruptor activado y la ciudad vacía, error en la ciudad, y **no sale en `/workshops`**;
  - `gerente@` y `mecanico@`: solo lectura, sin "Guardar" ni interruptor, con la explicación, y el PUT da **403**.
- **E16‑4 · Bandeja y detalle:**
  - los tres roles ven Nuevas 1, Abiertas 2 y Todas 3, por fecha descendente, y las pestañas se manejan con las flechas;
  - vacío: "No hay solicitudes nuevas" y salida a "Todas". Si el taller no sale en el directorio, nunca dice que le encuentran, y el owner tiene "Aparecer en el directorio";
  - detalle: la copia fija ("Kia Sportage", "7310 LFW", 2021, "Diésel", "SUV", "Gris grafito") y la silueta visible;
  - nunca el apodo ni el VIN. En la API, `perspective=workshop` y `vehicle_id=null`;
  - contacto con `mailto:` y `tel:`, e historial sin importes;
  - si el cliente retira el historial: "El cliente no comparte su historial.", la API da 403 y la pantalla no lo pide;
  - **el mecánico no ve "Aceptar", "Rechazar" ni "Enviar"** (en #3 y en #4), ve el presupuesto con su rótulo y sin importes, y la API le da **403** en `accept`, `reject` y `quotes`;
  - un tercero (`taller3@`) ve "Esta solicitud ya no existe", y la API da **404**. El mecánico recibe 404 en la solicitud de otro taller.
- **E16‑5 · Decidir:**
  - el camino 1, con presupuesto, deja la solicitud en "Presupuesto enviado";
  - el camino 2, sin presupuesto, en "Aceptada · falta el presupuesto", y el particular ve "Aceptada · presupuesto pendiente" y "El presupuesto llegará después";
  - "Rechazar" sin motivo da error junto al campo, y al cerrar, el foco vuelve a "Rechazar". Con motivo pasa a "Rechazada", sin botones, y el particular ve el motivo. Si hay un presupuesto vigente, el diálogo avisa de que el cliente ya no podrá aceptarlo;
  - **409** "Esta solicitud ya tiene respuesta." (dos personas aceptan a la vez), "Esta solicitud ya está cerrada." (rechazar una rechazada) y el 409 al enviar el presupuesto de una cancelada. En los tres casos, la pantalla se actualiza sin recargar ("Aceptada · falta el presupuesto", "Rechazada" o "Cancelada por el cliente").
- **E16‑6 · Presupuesto:**
  - IVA 21 y validez 15 por defecto, y el precio es obligatorio en el cliente;
  - los totales salen al escribir: 151,80 + 31,88 = **183,68 €**. En la API, `"183.68"` y `"31.88"`, strings con 2 decimales, y en pantalla con `Intl`;
  - un importe que no cabe da el 422 "El importe de las líneas no puede superar 49.999.999,99 €." y el diálogo sigue abierto;
  - validez de 91 días: "Entre 1 y 90 días";
  - el IVA con coma ("10,5") recalcula, y en la API queda `tax_rate "10.50"` y un total de 55,25;
  - la versión nueva parte de la vigente y avisa de que "La v1 quedará sustituida". En la API, v2 `sent` y v1 `superseded`, y en pantalla "Sustituido". Tras un rechazo, parte de la rechazada;
  - el rótulo **"Presupuesto (no es una factura)"** sale en el editor, en las tarjetas del taller, en las del mecánico y en las del particular.
- **Conversión** (con la tarea 34): "Ver la orden OT‑2026‑0035" lleva a la orden, que tiene "Juego de pastillas delanteras", 135,52 €, "Lucía Demo" y "Seat Ibiza", y aparece en el tablero. En la segunda conversión del mismo coche no se duplican ni el cliente ni el vehículo.
- **Perspectiva cruzada:**
  - una solicitud del taller abierta desde el espacio personal de `taller@` redirige a `/app/3/…` y no ofrece las acciones del cliente;
  - una solicitud propia de `gerente@` abierta desde el taller redirige a su espacio personal y no ofrece botones de decidir.

### Común

- Sin desbordes (`overflow=0`) y sin `undefined` ni `null` en pantalla, a 360 y a 1280, y también a 768 en la verificación final.
- **Consola:** solo los mensajes del navegador por los 401, 403, 404, 409 y 422 que se provocan a propósito. Ningún `pageerror`.

### Capturas

Hay 12 en total en [`2026-11-01-e16-capturas/`](2026-11-01-e16-capturas/).

Las 7 de la primera prueba. Seis se regeneraron el 03/11 entre las 01:45 y las 01:46, con las mismas escenas, cuando el arnés todavía las copiaba solo; `demo-mis-1280.png` es la original del 01/11:
- `taller-detalle-nueva-1280.png`;
- `gerente-editor-presupuesto-1280.png`;
- `taller-versiones-1280.png`;
- `gerente-409-1280.png`;
- `tercero-no-encontrado-1280.png`;
- `demo-aceptar-presupuesto-1280.png`;
- `demo-mis-1280.png`.

Las 5 del 03/11, copiadas en la verificación final (el corte de las 02:21 las dejó sin copiar):
- `taller-bandeja-360.png` y `mecanico-detalle-360.png`, de la repetición de `03-taller` a 360 de las 10:18, con los arreglos;
- `editor-lineas-dialogo-360.png`;
- `campana-360.png`;
- `estado-error-1280.png`.

Las demás están en `out/` del arnés, fuera del repo.

## Verificación final

Se hizo el 03/11, de 10:18 a 10:50 y sin supervisión, con el código del árbol de trabajo: los arreglos 1‑3 sin commit y el 4 de esta ejecución. Vale para las tareas 34 y 35.

Hasta ahora E16 solo se había probado a 360 y a 1280 px, y la definición de terminado pide también 768. Por eso, al final se pasaron a 768 los recorridos principales. A ese ancho ya hay barra lateral (`md`) y no hay navegación inferior. Para ello cambié en el arnés la condición del menú de `02-particular`, de `width >= 1000` a `width >= 768`.

**Instancia aislada,** arrancada de cero:
- API en `127.0.0.1:8050` con OPcache (`php -d zend_extension=opcache -S …`, desde `backend/public`) contra `carcare_front` de la MariaDB de `:3399`;
- Vite en `localhost:5183`, con `VITE_API_TARGET=http://127.0.0.1:8050`;
- `reseed.sh` (`migrate:fresh --seed`) antes de cada recorrido.

Al terminar se pararon solo esos dos procesos, buscando el PID por el puerto. Fue a las 10:40 y otra vez a las 10:50: para los recorridos a 768 se volvieron a arrancar igual. La MariaDB de `:3399` sigue arrancada, y `:8000`, `:5173` y `:3306` no se han tocado.

### Recorridos

| Hora (03/11) | Script | Cuentas | Ancho | Resultado |
|--------------|--------|---------|-------|-----------|
| 10:18‑10:20 | `03-taller.cjs` | `taller@`, `gerente@`, `mecanico@`, `taller3@` y `demo@` | 360 | **116 OK · 0 fallos** |
| 10:21‑10:23 | `03-taller.cjs` | ídem | 1280 | 55 OK · 1 fallo, y se cortó. Es un fallo del entorno, no de E16 (ver las limitaciones) |
| 10:24‑10:27 | `03-taller.cjs` | ídem | 1280 | **116 OK · 0 fallos** |
| 10:28‑10:29 | `02-particular.cjs` | `demo@` | 360 | **60 OK · 0 fallos** |
| 10:29‑10:30 | `07-teclado.cjs` | `demo@` y `taller@` | 360 | **9 OK · 0 fallos** |
| 10:33‑10:35 | `09-perfil-error.cjs` (nuevo, arreglo 4) | `taller3@` | 360 y 1280 | **4 OK · 0 fallos** en cada ancho |
| 10:35‑10:37 | `03-taller.cjs`, repetido tras el arreglo 4 | `taller@`, `gerente@`, `mecanico@`, `taller3@` y `demo@` | 360 | **116 OK · 0 fallos** |
| 10:37‑10:39 | `05-estados.cjs`, repetido tras el arreglo 4 | `demo@` y `taller@` | 360 | **42 OK · 0 fallos** |
| 10:44‑10:47 | `03-taller.cjs` | `taller@`, `gerente@`, `mecanico@`, `taller3@` y `demo@` | 768 | **116 OK · 0 fallos** |
| 10:47‑10:49 | `02-particular.cjs` | `demo@` | 768 | **59 OK · 0 fallos**: el menú, en la barra lateral, como a 1280 |
| 10:49‑10:50 | `07-teclado.cjs` | `demo@` y `taller@` | 768 | **9 OK · 0 fallos** |

En todos los recorridos:
- **Sin desbordes ni textos rotos.** `overflow=0` en todas las auditorías: 12 de `03-taller` a cada ancho, 8 de `02-particular` a cada ancho y 19 de `05-estados`. Ni `undefined`, ni `null`, ni `NaN`.
- **Ningún `pageerror`.** En la consola solo salen los 401 de `/me` antes de entrar y los 404, 409, 422 y 429 que se provocan a propósito.
- **El fallo a 360 de antes de los arreglos ya pasa:** "Mano de obra" cabe en el selector "Tipo", que mide 234 px y necesita 154. A 768, el editor sigue apilado, porque su contenedor no llega a `@3xl`, y el selector mide 570 px.
- **La orden** a la que lleva la solicitud convertida tiene las líneas a la vista en 592 ms a 360, en 1.011 ms a 768 y en 491 ms a 1280.

### Comandos

Desde `frontend/`. Se pasaron dos veces, a las 10:30 y a las 10:39 (después del arreglo 4), con el mismo resultado. Esta es la salida de la segunda:

| Comando | Resultado | Tiempo |
|---------|-----------|--------|
| `npm run typecheck` (`tsc -b`) | 0 errores | 25 s |
| `npm run lint` (`oxlint src`) | 0 errores y 74 avisos. Son reglas del React Compiler (`incompatible-library`, `purity`, `immutability`, `set-state-in-effect`…) y `only-export-components` en código anterior. Ninguno sale de las líneas cambiadas en esta tarea, y ninguno en `WorkshopRequestsPage.tsx` ni en `Tabs.tsx` | 2 s |
| `npm run test` (Vitest 4.1.12) | **14 archivos y 117 tests en verde.** De E16: `quoteForm` 18, `requestStatus` 16 y `notifications` 4. 8 tests son de `features/landing/hero.test.ts`, de la tarea 36 (portada), que lleva otro agente a la vez | 4 s (1,93 s de Vitest) |
| `npm run build` (`tsc -b && vite build`) | Correcto. Chunk inicial `index` de 190,08 kB (58,82 kB gzip). Las páginas de E16 van en sus propios chunks, por ejemplo `WorkshopRequestsPage` (8,39 kB), `WorkshopRequestDetailPage` (20,12 kB) y `RequestDetailPage` (11,77 kB). Solo hay un aviso, el ya conocido de `three` (1.001,56 kB), que se carga en diferido | 23 s (1,83 s de Vite) |

Los registros están fuera del repo, en `C:/Users/Alberto/AppData/Local/Temp/carcare-fe-e16/out/*.log`, junto con `typecheck.log`, `lint.log`, `test.log` y `build.log`.

## Limitaciones

- **Corte del 03/11 a las 02:21, resuelto:** algo externo cortó a la vez los dos servidores de la instancia aislada y la consola del agente, y la repetición de `03-taller` a 360 px no terminó. Se hizo entera en la verificación final, a las 10:18 y otra vez a las 10:35: 116 OK · 0 fallos.
- **Un fallo del entorno, intermitente y no reproducido** (03/11 a las 10:23, `03-taller` a 1280):
  - Lo que pasó: tras abrir la solicitud 5 como `demo@`, la página estuvo 30 s sin `<main>` y el recorrido se cortó tras 55 OK.
  - Por qué no es de E16: en el registro de la API no hay **ninguna** petición a `/me` en los 49 s siguientes a ese `goto`, y cada carga de página hace dos. O sea, la SPA ni llegó a arrancar en esa pestaña; el atasco estuvo al servir el frontend, no en la API ni en las pantallas.
  - La causa probable, sin demostrar: coincidió con 9 recargas en caliente (HMR) de `index.css` entre las 10:21:37 y las 10:21:58, por las ediciones del otro agente en `features/landing/`.
  - El mismo paso ha pasado en los otros cinco recorridos: a 1280 el 03/11 a las 02:20 y a las 10:24, a 360 a las 10:18 y a las 10:35, y a 768 a las 10:44.
  - Lo que queda en el arnés: `03-taller.cjs` guarda ahora la URL, el texto, la consola y una captura de cada pestaña si salta una excepción.
  - Si vuelve a pasar en el E2E del repo, hay que investigarlo con esos datos.
- **El mecánico recibe importes por la API:** `quotes[].total` y `unit_price` le llegan con cifras, y la pantalla no se los enseña. El contrato no dice que haya que ocultárselos, ni aquí ni en las órdenes (§3.11), así que no es un fallo del backend. Si se quiere que el mecánico no vea importes, hay que decidirlo en el contrato: ocultarlos en la interfaz no protege nada. Queda como petición para el arquitecto en el tablero.
- **Fuera de E16, solo anotado:**
  - El fallo: a 360 px, en Ajustes, la línea de datos de cada espacio ("Taller · Propietario · 21 vehículos · 3 miembros") se corta con puntos suspensivos, y se pierde "3 miembros".
  - Dónde: `features/settings/WorkspacesCard.tsx:90`, con `truncate` y sin el texto entero en otro sitio. Es código anterior.
  - Por qué no lo he tocado: no es de esta tarea. Bastaría con dejar que la línea salte.
  - La auditoría también marca el nombre del espacio en la cabecera ("Neumáticos Prueba"), pero ese recorte es a propósito y el nombre completo está en el nombre accesible del botón ("Espacio actual: … Cambiar de espacio").
- **"Recibido"** significa "orden abierta": la llegada física del coche no se registra (está fuera de alcance en las historias).
- **Solo Chromium**, sin lector de pantalla real.

## Siguiente paso

- El arquitecto decide si el mecánico debe recibir los importes de los presupuestos.
- `qa-tester`: E2E del flujo completo en el repo (tarea 6).
