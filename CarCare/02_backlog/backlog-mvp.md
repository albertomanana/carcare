# Backlog del producto (alcance del contrato v1)

*Última revisión: 23/10/2026 (agente producto, "mapa de huecos": estados contrastados con el código real). Sustituye al backlog E0‑E6 del plan inicial v1: se **mantienen los IDs** E0‑E6 (con criterios actualizados al contrato) y se añaden E7‑E15 por la ampliación del alcance (D7 particular + taller, D8 interfaz 3D).*

**Fuentes de verdad:** endpoints y reglas en [`docs/api/contrato-v1.md`](../../docs/api/contrato-v1.md) · formas JSON en [`frontend/src/api/types.ts`](../../frontend/src/api/types.ts) · decisiones en [`docs/arquitectura/`](../../docs/arquitectura/). Si un criterio de aquí contradice el contrato, **manda el contrato**: avisa al agente producto para corregir la historia.

**Leyenda**
- **Para:** `P` particular (espacio `personal`) · `T` taller (espacio `workshop`) · `P+T` ambos.
- **Prioridad** MoSCoW: `Must` · `Should` · `Could` · `Won't (por ahora)`.
- **Estado:**
  - `Falta`: no hay nada construido.
  - `En curso`: un agente lo está haciendo; se indica la tarea de [`AUTOPILOTO.md`](../../docs/equipo/AUTOPILOTO.md).
  - `A medias`: hay una parte construida y otra no; se dice cuál.
  - `Construido`: el flujo principal está en la app contra la API real y el backend tiene tests, pero la definición de terminado no se ha verificado (E2E, axe, 360/768/1280 px).
  - `Hecho`: solo con la definición de terminado cumplida y las evidencias en un informe.
  - `Decide Alberto`: bloqueado por una decisión pendiente.
  - `Descartado`.
- **A 23/10/2026 ninguna historia está `Hecho`.** De las 90 historias Must y Should:
  - 71 están `Construido`;
  - 7 están `A medias`;
  - 8 están en `Falta` (4 de ellas son de calidad y ya están en la cola: tareas 6, 7 y 11);
  - 4 están `En curso`.

  El paso a `Hecho` llega con las tareas 5 (integración), 6 (E2E y axe) y 8 (revisión de UX) de la cola. El detalle, con la evidencia (ruta del archivo) de cada historia, está en el informe [2026-10-23-producto-mapa-de-huecos](../../docs/equipo/informes/2026-10-23-producto-mapa-de-huecos.md).
- Historias largas con archivo propio: [E8‑6](E8-6-mapa-zonas-3d.md) · [E12‑2](E12-2-tablero-kanban-elevadores.md) · [E12‑5](E12-5-entrega-orden-crea-intervencion.md).

## Resumen por épica

| Épica | Para | Must | Should | Could | Estado global (23/10/2026) |
|-------|------|:----:|:------:|:-----:|---------------|
| E0 Base del proyecto | — | 3 | 0 | 0 | Construido, salvo CI (Falta, tarea 11) |
| E1 Autenticación y perfil | P+T | 6 | 2 | 0 | Construido, salvo E1‑6 (Decide Alberto, D17) |
| E2 Garaje | P+T | 6 | 0 | 1 | Construido |
| E3 Intervenciones | P+T | 8 | 0 | 0 | Construido; E3‑3 a medias |
| E4 Gastos | P | 5 | 1 | 0 | Construido (E4‑2 y E4‑3 con criterio revisado) |
| E5 Dashboard particular | P | 7 | 0 | 0 | Construido; E5‑7 a medias |
| E6 Calidad y entregables | — | 5 | 1 | 0 | Casi todo falta: la calidad (E2E, axe, seguridad) está en las tareas 5‑11 de la cola |
| E7 Seguimiento diario | P (+T km) | 4 | 1 | 1 | Construido; E7‑1 y E7‑5 a medias |
| E8 Recordatorios y mapa de zonas 3D | P+T | 4 | 2 | 2 | Construido (Must y Should); faltan los Could |
| E9 Documentos | P+T | 0 | 3 | 1 | Construido (Should); falta E9‑4 |
| E10 Informe exportable | P | 0 | 2 | 2 | Construido (Should); faltan los Could |
| E11 Taller: clientes | T | 4 | 2 | 0 | Construido; falta E11‑6 (RGPD) |
| E12 Órdenes de trabajo y elevadores | T | 5 | 3 | 2 | Construido; E12‑8 a medias; E12‑9 Decide Alberto (D12) |
| E13 Equipo y roles | T | 5 | 2 | 1 | Construido; E13‑7 a medias |
| E14 Experiencia 3D | P+T | 4 | 2 | 2 | Construido; E14‑7 en curso (tarea 20) |
| E15 Analítica de espacio | P+T | 1 | 2 | 1 | En curso (tarea 17); falta E15‑2 (taller) |

**Núcleo defendible** (si hay que recortar, ver D9): E1, E2, E3, E4, E5, E7‑1…4, E8‑1…3 y E8‑6, E11‑1…4, E12‑1…5, E13‑1…4, E14‑2/5/6, E6‑1/2/4. A 23/10/2026 **todo el núcleo está construido** salvo E6‑2 (E2E) y las partes a medias de E5‑7 y E7‑1. Lo primero que se recortaría ya está construido (taller 3D, rayos X, portada 3D, documentos, informe), así que **D9 ya no afecta a la construcción**: afecta a los Should que faltan (E1‑6, E11‑6, E15‑2) y a la calidad.

---

## E0 · Base del proyecto

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E0‑1 | Como desarrollador quiero backend y frontend arrancables con instrucciones claras para trabajar y para la demo | — | Must | Construido | `README.md`, `iniciar-carcare.bat`, `scripts/servidor-api.cmd` |
| E0‑2 | Como desarrollador quiero CI con lint y tests en cada push para no romper nada sin darme cuenta | — | Must | Falta | D5 (remoto en GitHub); tarea 11 de la cola (devops) |
| E0‑3 | Como desarrollador quiero tokens de diseño y componentes base reutilizables | — | Must | Construido (criterio revisado 23/10) | — |

**Criterios de aceptación**
- **E0‑1**: Dado un equipo con XAMPP y Node, cuando sigo el `README`, entonces `php artisan serve` + `npm run dev` levantan la app y `GET /api/v1/health` responde `200 {"status":"ok"}`. Y `php artisan migrate:fresh --seed` deja los datos demo del §5 del contrato.
- **E0‑2**: Dado un push al remoto, cuando corre el workflow, entonces se ejecutan Pint, ESLint, `tsc`, tests del backend y Vitest, y el workflow falla si alguno falla.
- **E0‑3**: Dadas las pantallas de la app, cuando uso botones (primario, secundario, fantasma, peligro), campos con error, tarjetas y los estados vacío/carga/error, entonces salen de los componentes de `frontend/src/components/ui/` con los tokens de `index.css` y tienen foco visible por teclado. *(Revisado el 23/10/2026: la "página interna solo de desarrollo" con el muestrario pasa a Could. No aporta al usuario ni al TFG, y los componentes ya existen y se reutilizan.)*

## E1 · Autenticación y perfil

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E1‑1 | Como particular quiero registrarme con nombre, email y contraseña para tener mi garaje | P | Must | Construido | — |
| E1‑8 | Como dueño de un taller quiero registrarme como taller para gestionar mi negocio desde el primer minuto | T | Must | Construido | E1‑1 |
| E1‑2 | Como usuario quiero iniciar y cerrar sesión de forma segura | P+T | Must | Construido | — |
| E1‑3 | Como usuario quiero que mis páginas privadas exijan sesión | P+T | Must | Construido | E1‑2 |
| E1‑4 | Como usuario quiero editar mi perfil y cambiar mi contraseña | P+T | Must | Construido | — |
| E1‑5 | Como usuario quiero que nadie de otro espacio pueda ver ni tocar mis datos | P+T | Must | Construido | `IsolationTest.php` (215 casos) |
| E1‑6 | Como usuario quiero recuperar mi contraseña por email | P+T | Should | Falta · **Decide Alberto (D17)** | No está en el contrato v1; necesita enviar correo. Tarea propuesta 28 |
| E1‑7 | Como usuario quiero eliminar mi cuenta y mis datos | P+T | Should | Construido | — |

**Criterios de aceptación**
- **E1‑1**: Dado el formulario de registro, cuando envío nombre (2‑100), email válido no usado y contraseña ≥ 8 confirmada, entonces recibo `201`, quedo con la sesión iniciada y se crea mi espacio `personal` "Mi garaje". Si el email ya existe (sin distinguir mayúsculas), veo el error junto al campo. El email se guarda en minúsculas.
- **E1‑8**: Dado el registro con `account_type = workshop`, cuando indico `workshop_name` (2‑100), entonces se crean **mi espacio personal y un espacio taller** del que soy `owner`. Sin `workshop_name`, recibo `422` junto al campo.
- **E1‑2**: Dadas credenciales erróneas, cuando intento entrar, entonces veo el mensaje genérico "Las credenciales no son correctas.". Tras 5 intentos fallidos en un minuto (email + IP) recibo `429` con un mensaje comprensible. Al cerrar sesión (`204`), volver atrás en el navegador no muestra datos privados.
- **E1‑3**: Dado que no tengo sesión, cuando abro una ruta privada, entonces voy al login y, tras entrar, vuelvo a la ruta que pedí. La API responde `401`.
- **E1‑4**: Dado mi perfil, cuando cambio el nombre o el email, entonces el cambio persiste al recargar. Cambiar la contraseña exige la actual (`422` si no coincide) y devuelve `204`.
- **E1‑5**: Dados un usuario A y un usuario B sin espacios en común, cuando B pide, edita o borra cualquier recurso de A (vehículo, intervención, gasto, recordatorio, documento, cliente, orden), entonces recibe **`404`**, nunca `403` ni los datos. Hay **un test de aislamiento por endpoint**.
- **E1‑7**: Dado el diálogo de baja, cuando confirmo con mi contraseña, entonces se borran mi espacio personal y sus datos, y también los talleres donde soy el único `owner`. Con una contraseña incorrecta no se borra nada.
- **E1‑6**: Dado "He olvidado mi contraseña", cuando pido el enlace, entonces recibo un email con un enlace de un solo uso y con caducidad. La respuesta es la misma exista o no la cuenta.

## E2 · Garaje

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E2‑1 | Como usuario quiero añadir un vehículo en un formulario por pasos para empezar rápido | P+T | Must | Construido | E14‑3 (vista previa 3D, opcional) |
| E2‑2 | Como usuario quiero ver la lista de vehículos de mi espacio | P+T | Must | Construido | E14‑5 |
| E2‑3 | Como usuario quiero ver la ficha de un vehículo | P+T | Must | Construido | — |
| E2‑4 | Como usuario quiero editar un vehículo | P+T | Must | Construido | — |
| E2‑5 | Como owner/manager quiero archivar y restaurar vehículos | P+T | Must | Construido | E13‑4 |
| E2‑6 | Como particular quiero apuntar los km actuales en un toque desde la ficha o el dashboard | P+T | Must | Construido | E7‑1 |
| E2‑7 | Como owner/manager quiero eliminar definitivamente un vehículo archivado | P+T | Could | Construido | E2‑5 |

**Criterios de aceptación**
- **E2‑1**: Dado el paso 1 (marca 1‑60 y modelo 1‑80 obligatorios), cuando pulso "Guardar", entonces el vehículo se crea (`201`) aunque no rellene los pasos 2 (año, combustible, cambio, motor, carrocería, color) y 3 (matrícula, VIN, km, compra). El año debe estar entre 1900 y el año actual + 1. El VIN, si existe, tiene 17 caracteres `[A-HJ-NPR-Z0-9]` y es único en el espacio. La matrícula se normaliza (mayúsculas, sin espacios ni guiones) y es única entre los no archivados del espacio. Si indico km actuales, se crea la primera lectura (`source = vehicle_created`).
- **E2‑2**: Dado mi espacio, cuando abro el garaje, entonces veo tarjetas con **miniatura estática** (no un WebGL por tarjeta), nombre, matrícula y km. Puedo buscar por marca, modelo, apodo, matrícula, VIN (y cliente en taller) y ordenar por recientes, nombre o km. Sin vehículos veo un estado vacío con "Añadir vehículo".
- **E2‑3**: Dada la ficha, cuando la abro, entonces veo los datos, los km con la fecha de lectura y el acceso a historial, gastos, diario, recordatorios, documentos e informe. Los campos sin dato muestran "Sin indicar", nunca un valor inventado.
- **E2‑4**: Dado el formulario de edición, cuando guardo, entonces los cambios persisten. Los km **no** se editan aquí: el campo lleva a "Registrar lectura" (E2‑6).
- **E2‑5**: Dado un vehículo activo, cuando lo archivo y confirmo, entonces desaparece del selector y del dashboard, conserva su historial y aparece en "Archivados", desde donde puedo restaurarlo. Un `mechanic` no ve la acción y la API le devuelve `403`.
- **E2‑6**: Dada la ficha o el dashboard, cuando introduzco km y fecha (no futura), entonces se guarda la lectura y se actualizan los km del vehículo. Si no cuadra con lecturas anteriores, veo el mensaje del contrato ("El kilometraje no cuadra…") y puedo confirmarlo (`confirm_mileage_drop`).
- **E2‑7**: Dado un vehículo **archivado**, cuando confirmo el borrado escribiendo su nombre, entonces se borran el vehículo, su historial y sus archivos. Con un vehículo no archivado la API responde `409`.

## E3 · Mantenimiento, reparaciones y averías

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E3‑1 | Como usuario quiero registrar una intervención para tener el historial del coche | P+T | Must | Construido | — |
| E3‑8 | Como usuario quiero indicar la zona y el tipo de servicio para que alimenten el mapa 3D y el "desde el último…" | P+T | Must | Construido | E3‑1 |
| E3‑2 | Como usuario quiero desglosar piezas y mano de obra | P+T | Must | Construido | E3‑1 |
| E3‑3 | Como usuario quiero ver el historial como línea temporal con filtros | P+T | Must | A medias: no agrupa por año (solo filtra). Tarea propuesta 26 | — |
| E3‑4 | Como usuario quiero ver el detalle de una intervención | P+T | Must | Construido (detalle desplegable en la tarjeta del historial) | — |
| E3‑5 | Como usuario quiero editar y archivar intervenciones | P+T | Must | Construido | — |
| E3‑6 | Como particular quiero que una intervención con coste cuente como gasto sin apuntarla dos veces | P | Must | Construido | ADR‑0003 (D3) |
| E3‑7 | Como usuario quiero que el kilometraje de una intervención sea coherente con el resto | P+T | Must | Construido | E7‑1 |

**Criterios de aceptación**
- **E3‑1**: Dado el formulario, cuando indico tipo (`maintenance`, `repair`, `breakdown`, `inspection`, `tyres`, `bodywork`, `other`), zona, título (2‑120) y fecha no futura, entonces se crea (`201`) asociada al vehículo correcto. Km, taller, descripción e importes son opcionales; los importes van de 0 a 999.999,99 con 2 decimales.
- **E3‑8**: Dada una intervención con `zone = brakes` y `service_kind = brakes`, cuando consulto las zonas del vehículo, entonces la zona Frenos muestra esa intervención como `last_record`. Una intervención con `service_kind = oil` actualiza "Desde el último cambio de aceite" en el resumen.
- **E3‑2**: Dadas líneas (pieza, mano de obra, fluido, otro; hasta 50; cantidad > 0), cuando añado o quito líneas, entonces el total de cada línea lo calcula el servidor (cantidad × precio) y el total se recalcula en pantalla. Si edito el total a mano y no cuadra con el desglose, se me avisa. Al editar, enviar `items` **reemplaza** todas las líneas.
- **E3‑3**: Dado el historial, cuando lo abro, entonces está ordenado por fecha descendente (desempate por km), agrupado por año, y puedo filtrar por tipo, zona y año y buscar por título, taller o descripción. Con filtros sin resultados veo "Sin resultados" y la opción de limpiarlos.
- **E3‑4**: Dada una intervención, cuando abro su detalle, entonces veo todos los campos, las líneas, los documentos vinculados y, si existe, el enlace a la orden de trabajo de origen.
- **E3‑5**: Dada una intervención, cuando la edito o la archivo, entonces el cambio persiste. Las archivadas se pueden ver con un filtro y restaurar.
- **E3‑6**: Dado un espacio **personal**, cuando guardo una intervención con `total_cost > 0`, entonces en Gastos aparece un gasto "desde intervención" con enlace a ella, que no se puede editar ni borrar allí (`409`). La categoría es `repair` para reparación, avería o carrocería, `inspection` para inspección y `maintenance` para el resto. Si el coste pasa a 0 o null, o si archivo la intervención, el gasto desaparece; al restaurarla, reaparece. **Test: los totales no cuentan dos veces.** En un taller no se genera gasto.
- **E3‑7**: Dada una intervención con km, cuando la guardo, entonces se crea una lectura `source = maintenance` y se aplican las reglas de §3.4 del contrato: `422` con mensaje y opción de confirmar si no cuadra.

## E4 · Gastos

*Permiso: `owner` en personal; `manage` (owner o manager) en taller. Un `mechanic` recibe `403`.*

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E4‑1 | Como particular quiero registrar un gasto (seguro, impuesto, parking, peaje, lavado, multa…) | P | Must | Construido | — |
| E4‑2 | Como particular quiero listar y filtrar mis gastos | P | Must | Construido (criterio revisado 23/10) | — |
| E4‑3 | Como particular quiero ver totales y gráficos que cambian con los filtros | P | Must | Construido (criterio revisado 23/10) | E4‑2 |
| E4‑4 | Como particular quiero saber mi coste por kilómetro cuando haya datos suficientes | P | Must | Construido | E7‑1 |
| E4‑5 | Como particular quiero editar y borrar gastos manuales | P | Must | Construido | — |
| E4‑6 | Como particular quiero comparar con el periodo anterior | P | Should | Construido | E4‑3 |

**Criterios de aceptación**
- **E4‑1**: Dado el formulario, cuando indico categoría, importe > 0 y fecha no futura, entonces se guarda (`201`). Cantidad, unidad y depósito lleno solo se muestran y se aceptan con la categoría `fuel` (ver E7‑2). El km es opcional y crea una lectura.
- **E4‑2**: Dado el listado de gastos del vehículo, cuando filtro por periodo (este año, últimos 12 meses o año pasado) y por categoría, entonces la URL conserva los filtros y al recargar se mantienen. *(Revisado el 23/10/2026: el periodo "mes, trimestre, personalizado" y la selección de varias categorías pasan a Could. Motivo: Alberto pidió una interfaz más simple, y los periodos a medida viven en la Analítica (E15).)*
- **E4‑3**: Dados unos datos de prueba conocidos, cuando cambio los filtros de la pestaña Gastos, entonces el total del periodo y el reparto por categoría cambian **a la vez** y coinciden exactamente con la suma de los gastos (test). Las barras de los 12 meses (meses sin gasto a 0) están en el Resumen del vehículo, en la Cabina y en la Analítica, con el mismo origen de datos. *(Revisado el 23/10/2026 para que coincida con la app actual, que es más simple.)*
- **E4‑4**: Dado un periodo con ≥ 2 lecturas separadas ≥ 500 km **y** ≥ 30 días, cuando abro la analítica, entonces veo el coste/km = total del periodo ÷ (km máx − km mín). Si no se cumplen las condiciones, veo el `reason` de la API ("Necesitas al menos dos lecturas…") y un botón "Registrar kilometraje".
- **E4‑5**: Dado un gasto manual, cuando lo edito o lo borro con confirmación, entonces el cambio persiste y los totales se actualizan. Un gasto vinculado muestra "desde intervención" con enlace y no ofrece esas acciones.
- **E4‑6**: Dado un periodo cuyo periodo anterior (de la misma duración) tiene gastos, cuando lo veo, entonces aparece la variación en % con 1 decimal. Si el periodo anterior no tiene datos, no se muestra ningún %.

## E5 · Dashboard del particular

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E5‑1 | Como particular quiero ver mi coche como protagonista y cambiar de vehículo | P | Must | Construido | E14‑2 |
| E5‑2 | Como particular quiero KPI reales del gasto y del uso | P | Must | Construido | E4, E7 |
| E5‑3 | Como particular quiero ver mi actividad reciente | P | Must | Construido | — |
| E5‑4 | Como particular quiero ver el gasto de los últimos 12 meses | P | Must | Construido | E4‑3 |
| E5‑5 | Como particular quiero saber cuánto hace del último cambio de aceite, revisión e ITV | P | Must | Construido | E3‑8 |
| E5‑6 | Como particular quiero accesos rápidos para apuntar en segundos (repostaje, km, intervención, gasto) | P | Must | Construido | — |
| E5‑7 | Como particular nuevo quiero estados vacíos que me guíen | P | Must | A medias: falta la tarjeta guía para un vehículo sin datos. Tarea propuesta 26 | — |

**Criterios de aceptación**
- **E5‑1**: Dados varios vehículos, cuando cambio de vehículo en el selector, entonces el coche 3D cambia de carrocería y color, y la app recuerda el último elegido al volver. Sin WebGL veo la silueta (E14‑6).
- **E5‑2**: Dado el dashboard, cuando carga, entonces el gasto del mes y del año, los km del mes, los recordatorios vencidos o próximos y la última intervención salen de `GET /workspaces/{ws}/dashboard` y `GET /vehicles/{v}/summary`. Ninguna cifra se calcula con datos inventados, y una cifra no disponible muestra su motivo.
- **E5‑3**: Dada actividad registrada, cuando abro el dashboard, entonces veo las últimas acciones (`recent_activity`) con frase en español y enlace a cada elemento.
- **E5‑4**: Dado el gráfico, cuando lo veo, entonces tiene 12 barras (meses sin gasto a 0), el mes actual resaltado y un tooltip accesible por teclado con el importe en formato `1.234,56 €`.
- **E5‑5**: Dadas intervenciones con `service_kind` `oil`, `service` o `itv`, cuando veo "Desde el último…", entonces cada fila dice la fecha, los días y los km transcurridos (`null` ⇒ "Sin dato de km"). Si no hay registro, veo "Sin registros" y el botón para añadirlo.
- **E5‑6**: Dado el dashboard en 360 px, cuando pulso "Repostaje", "Km", "Intervención" o "Gasto", entonces se abre el formulario con el vehículo seleccionado ya elegido, sin desplazarme para encontrar el botón.
- **E5‑7**: Dado un usuario sin vehículos, cuando entra, entonces ve el onboarding del primer vehículo. Dado un vehículo sin datos, ve una tarjeta guía con los 3 primeros pasos (km, primer repostaje, primera intervención o recordatorio).

## E6 · Calidad y entregables

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E6‑1 | Como evaluador quiero datos demo realistas y claramente ficticios para ver la app viva | P+T | Must | En curso (tarea 19) | backend-laravel |
| E6‑2 | Como equipo quiero E2E de los recorridos principales (particular y taller) | P+T | Must | Falta (no existe `frontend/e2e/`) | Tarea 6 (qa-tester) |
| E6‑3 | Como usuario con discapacidad quiero poder usar todas las pantallas | P+T | Must | Falta (sin auditoría axe) | Tareas 6 y 8 (qa-tester, disenador-ux) |
| E6‑4 | Como tribunal quiero documentación técnica (README, API, E‑R, ADR) | — | Must | A medias: `docs/tfg/01…08`, contrato, ADR y README existen; faltan los manuales | Tarea 10 (documentador-tfg) |
| E6‑5 | Como responsable quiero una auditoría de seguridad antes de cada entrega | P+T | Must | Falta | Tarea 7 (seguridad) |
| E6‑6 | Como producto quiero probar la app con 3‑5 particulares y 2‑3 talleres antes de cerrar el alcance | P+T | Should | Falta | Tarea propuesta 30; necesita a Alberto; [guion](../06_investigacion/guion-prueba-usuarios.md) |

**Criterios de aceptación**
- **E6‑1**: Dado `php artisan migrate:fresh --seed`, cuando entro como `demo@carcare.test` y como `taller@carcare.test`, entonces veo exactamente lo descrito en §5 del contrato (2 vehículos con ~18 meses de historial; un taller con 4 elevadores, ~12 clientes, ~20 vehículos y ~30 órdenes en todos los estados). Con `APP_ENV=production` el seeder aborta.
- **E6‑2**: Dados backend y frontend arrancados, cuando ejecuto `npm run test:e2e`, entonces pasan al menos estos recorridos, en 1280 y 360 px: (a) registro → vehículo → repostaje → intervención con coste → el dashboard muestra los totales esperados sin doble conteo; (b) taller: cliente → vehículo → orden → elevador → entregar → la intervención aparece en el historial; (c) un `mechanic` no ve facturación.
- **E6‑3**: Dadas las pantallas del núcleo, cuando paso axe, entonces no hay errores críticos ni serios. Todo se puede usar con teclado y el foco es visible. El 3D tiene alternativa HTML (E14‑6).
- **E6‑4**: Dado el repositorio, cuando lo abro, entonces hay un README de instalación, el contrato de API, el diagrama E‑R a partir de las migraciones reales y los ADR.
- **E6‑5**: Dada una entrega, cuando `seguridad` revisa, entonces hay un informe con: aislamiento entre espacios, permisos por rol, subida y descarga de archivos, cabeceras, límites de peticiones y dependencias con vulnerabilidades conocidas. Las incidencias altas se corrigen antes de cerrar la entrega.
- **E6‑6**: Dado el guion de prueba, cuando se realizan las sesiones, entonces cada una queda anotada con `_plantilla-entrevista.md` y hay un resumen con las métricas reales (éxito, tiempo, SEQ, SUS), sin inventar resultados.

## E7 · Seguimiento diario

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E7‑1 | Como usuario quiero ver y corregir el historial de lecturas de km | P+T | Must | A medias: el origen sale como texto, sin enlace (falta `source_id` en el contrato). Tarea propuesta 27 | — |
| E7‑2 | Como particular quiero registrar un repostaje o una carga eléctrica | P | Must | Construido | E4‑1 |
| E7‑3 | Como particular quiero conocer mi consumo medio real | P | Must | Construido | E7‑2 |
| E7‑4 | Como particular quiero un diario del coche día a día | P | Must | Construido | E7‑1, E7‑2 |
| E7‑5 | Como particular quiero saber cuántos km hago al mes, al año y de media al día | P | Should | A medias: los km del año no se muestran. Tarea propuesta 26 | E7‑1 |
| E7‑6 | Como particular quiero ver la evolución del kilometraje en un gráfico | P | Could | Construido (tabla accesible sin verificar) | E7‑1 |

**Criterios de aceptación**
- **E7‑1**: Dadas lecturas de varias fuentes, cuando abro el historial de km, entonces veo cada lectura (fecha desc., luego km) con su origen (manual, alta del vehículo, intervención, gasto, orden, recordatorio) y un enlace al registro de origen. Solo las `manual` se pueden borrar. Al borrar una, `current_mileage` se recalcula (lectura más reciente por fecha, desempate por mayor km).
- **E7‑2**: Dado un gasto de categoría `fuel`, cuando indico importe, cantidad, unidad y "depósito lleno", entonces se guarda. La unidad por defecto es `kwh` si el vehículo es eléctrico y `l` en el resto. Si cambio a otra categoría, esos campos no se envían o se guardan como null.
- **E7‑3**: Dados ≥ 2 repostajes con depósito lleno y km, cuando veo el resumen, entonces el consumo se calcula por el método lleno‑a‑lleno del §4 del contrato, con la unidad que corresponde (`l/100km`, `kwh/100km`, `kg/100km`) y el número de repostajes usados. Si no hay datos suficientes, veo el `reason` y la acción "Registrar repostaje con depósito lleno". **Test con datos conocidos.**
- **E7‑4**: Dado un vehículo con actividad, cuando abro el diario, entonces veo los últimos 30 días (o el rango elegido) en orden descendente, sin los días vacíos. Cada día muestra los km recorridos (o "—" si no se puede saber), lo gastado y sus entradas (km, gasto, intervención, recordatorio completado, documento), cada una enlazada.
- **E7‑5**: Dadas ≥ 2 lecturas, cuando veo el resumen, entonces aparecen los km del mes, los del año y la media diaria (últimos 90 días, mínimo 7 días entre lecturas). Si falta algo, el dato es null y se muestra "Faltan lecturas para calcularlo".
- **E7‑6**: Dadas lecturas en los últimos 12 meses, cuando veo el gráfico, entonces muestra la serie ascendente de `summary.mileage.series`, con una tabla equivalente accesible.

## E8 · Recordatorios y mapa de zonas 3D

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E8‑1 | Como usuario quiero crear recordatorios por fecha y/o km (ITV, seguro, aceite…) | P+T | Must | Construido | — |
| E8‑2 | Como usuario quiero ver de un vistazo qué está vencido o próximo, sin que parezca un diagnóstico | P+T | Must | Construido | E8‑1 |
| E8‑3 | Como usuario quiero marcar un recordatorio como hecho y que se programe el siguiente | P+T | Must | Construido | E8‑1 |
| E8‑4 | Como usuario quiero descartar o borrar un recordatorio | P+T | Should | Construido | E8‑1 |
| E8‑5 | Como usuario quiero una agenda con todos los recordatorios del espacio | P+T | Should | Construido | E8‑2 |
| E8‑6 | Como usuario quiero tocar una zona del coche 3D y ver su historial y su próximo aviso | P+T | Must | Construido | E8‑2, E3‑8, E14‑2 · [archivo](E8-6-mapa-zonas-3d.md) |
| E8‑7 | Como particular quiero plantillas de recordatorios habituales con valores editables | P | Could | Falta | E8‑1 |
| E8‑8 | Como usuario quiero recibir un email antes de que venza un recordatorio | P+T | Could | Falta | Fase 2: correo + tareas programadas (D17) |

**Criterios de aceptación**
- **E8‑1**: Dado el formulario, cuando indico título, tipo y al menos fecha **o** km (ninguno ⇒ `422`), y opcionalmente recurrencia en meses y/o km, entonces se crea con la zona por defecto de su tipo (aceite o distribución → motor; neumáticos → neumáticos; frenos → frenos; batería → eléctrico; el resto → general), que puedo cambiar.
- **E8‑2**: Dado un recordatorio pendiente, cuando lo veo, entonces muestra su estado con **icono + texto + color** (vencido, próximo, al día, sin datos), los días y/o km restantes y una barra de progreso con la leyenda **"según tus intervalos, no medido"**. Es `soon` si quedan ≤ 30 días o ≤ 1.000 km. Es `unknown` si depende de km y el coche no tiene km.
- **E8‑3**: Dado un recordatorio con recurrencia, cuando lo completo con fecha y km, entonces queda `done`, se crea una lectura de km (`source = reminder`) y se crea el siguiente (`due_date = fecha + meses`, `due_mileage = km + recurrencia`) salvo que desmarque "crear el siguiente". La respuesta incluye `completed` y `next`.
- **E8‑4**: Dado un recordatorio, cuando lo descarto, entonces pasa a `dismissed` y deja de contar en zonas y dashboard. Borrarlo pide confirmación y devuelve `204`.
- **E8‑5**: Dado un espacio con varios vehículos, cuando abro la agenda, entonces veo los pendientes de todos ordenados por urgencia (vencido, próximo, al día, sin datos), con su vehículo, y puedo filtrar por estado.
- **E8‑6**: ver [archivo de la historia](E8-6-mapa-zonas-3d.md).
- **E8‑7**: Dada la creación de un recordatorio, cuando elijo una plantilla (p. ej. "Cambio de aceite"), entonces se rellenan valores **de ejemplo** marcados como "orientativos: consulta el manual de tu coche", todos editables. Nunca se presentan como datos del fabricante.
- **E8‑8**: Dado un recordatorio que pasa a `soon`, cuando corre la tarea diaria, entonces recibo un email (una sola vez por recordatorio y estado) con un enlace al vehículo, y puedo desactivar los avisos en Ajustes.

## E9 · Documentos

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E9‑1 | Como usuario quiero subir facturas, pólizas, la tarjeta de ITV o fotos al vehículo o a una intervención | P+T | Should | Construido | — |
| E9‑2 | Como usuario quiero encontrar, ver y descargar mis documentos de forma privada | P+T | Should | Construido | E9‑1 |
| E9‑3 | Como usuario quiero borrar un documento | P+T | Should | Construido | E9‑1 |
| E9‑4 | Como particular quiero crear un recordatorio a partir de la caducidad de un documento | P | Could | Falta | E9‑1, E8‑1 |

**Criterios de aceptación**
- **E9‑1**: Dado un PDF, JPEG, PNG o WEBP de ≤ 10 MB, cuando lo subo con título y tipo (factura, seguro, ITV, permiso de circulación, manual, foto, otro), y opcionalmente una intervención **del mismo vehículo** y una caducidad, entonces se guarda (`201`) en disco privado con nombre UUID. Si el tipo MIME real no está permitido o el archivo pasa de 10 MB, veo el error junto al campo.
- **E9‑2**: Dados mis documentos, cuando filtro por tipo o por intervención y abro uno, entonces el PDF o la imagen se ven integrados (`?inline=1`) o se descargan, con `X-Content-Type-Options: nosniff`. Si la URL es de un documento de otro espacio, recibo `404`.
- **E9‑3**: Dado un documento, cuando lo borro con confirmación, entonces la API devuelve `204` y el fichero desaparece del disco (test).
- **E9‑4**: Dado un documento con caducidad, cuando pulso "Recordármelo", entonces se abre la creación de recordatorio con la fecha y el tipo ya rellenos (seguro, ITV…).

## E10 · Informe exportable

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E10‑1 | Como particular quiero un informe completo de mi coche para venderlo o para mí | P | Should | Construido | E3, E4, E7, E9 |
| E10‑2 | Como particular quiero guardar el informe en PDF | P | Should | Construido (diálogo de impresión del navegador) | E10‑1 |
| E10‑3 | Como particular quiero compartir el informe con un comprador mediante un enlace temporal | P | Could | Falta | Necesita ADR (privacidad); ver I9 |
| E10‑4 | Como usuario quiero exportar todos mis datos (CSV/JSON) | P+T | Could | Falta | RGPD (portabilidad) |

**Criterios de aceptación**
- **E10‑1**: Dado un vehículo, cuando abro su informe (`GET /vehicles/{v}/report`), entonces veo los datos del vehículo, el historial completo con líneas, los gastos por categoría y por año, las lecturas de km, los recordatorios pendientes y la lista de documentos. Muestra la **fecha de generación** y el aviso "Datos introducidos por el propietario; CarCare no los verifica".
- **E10‑2**: Dado el informe, cuando pulso "Guardar en PDF", entonces el diálogo de impresión del navegador genera un PDF legible en A4 (sin navegación ni botones, con cabecera y fecha de generación).
- **E10‑3**: Dado el informe, cuando genero un enlace, entonces cualquiera con el enlace puede verlo en solo lectura hasta la caducidad que elija, y puedo revocarlo. Sin ADR aprobado no se construye.
- **E10‑4**: Dado Ajustes, cuando pido "Exportar mis datos", entonces descargo un archivo con todos mis vehículos y registros.

## E11 · Taller: clientes

*Solo en espacios `workshop`. En `personal` estas rutas responden `404`.*

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E11‑1 | Como recepcionista o mecánico quiero dar de alta un cliente en segundos | T | Must | Construido | E13‑1 |
| E11‑2 | Como taller quiero buscar clientes por nombre, teléfono, email o NIF | T | Must | Construido | E11‑1 |
| E11‑3 | Como taller quiero ver la ficha de un cliente con sus vehículos y órdenes abiertas | T | Must | Construido | E11‑1 |
| E11‑4 | Como taller quiero asociar un vehículo a su cliente | T | Must | Construido | E2‑1 |
| E11‑5 | Como owner/manager quiero eliminar un cliente | T | Should | Construido | — |
| E11‑6 | Como taller quiero cumplir el RGPD con los datos de mis clientes (informar, exportar, borrar) | T | Should | Falta | Antes de cualquier uso real; ver R21. Necesita un cambio de contrato. Tarea propuesta 29 |

**Criterios de aceptación**
- **E11‑1**: Dado el formulario, cuando indico el nombre (obligatorio) y opcionalmente email, teléfono, NIF y notas, entonces se crea (`201`). Cualquier rol con `operate` puede hacerlo.
- **E11‑2**: Dado el listado paginado, cuando escribo en el buscador, entonces filtra por nombre, email, teléfono o NIF.
- **E11‑3**: Dado un cliente, cuando abro su ficha, entonces veo sus datos, sus vehículos (`GET /customers/{c}/vehicles`), cuántas órdenes abiertas tiene y el enlace a ellas (`?customer_id=`).
- **E11‑4**: Dado un vehículo de un taller, cuando elijo su cliente, entonces se guarda `customer_id` (del mismo espacio). En un espacio personal la API responde `422`.
- **E11‑5**: Dado un cliente sin órdenes abiertas, cuando un owner o manager lo elimina con confirmación, entonces sus vehículos quedan sin cliente. Si tiene órdenes abiertas, recibe `409` con el motivo. Un `mechanic` no ve la acción.
- **E11‑6**: Dada la ficha de un cliente, cuando un manager pulsa "Exportar datos del cliente" o "Borrar datos personales", entonces obtiene sus datos o se anonimizan nombre, email, teléfono y NIF conservando el historial técnico del vehículo.

## E12 · Órdenes de trabajo y elevadores

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E12‑1 | Como recepcionista quiero abrir una orden de trabajo cuando llega un coche | T | Must | Construido | E11‑4 |
| E12‑2 | Como jefe de taller quiero un tablero kanban de órdenes y elevadores | T | Must | Construido | E12‑1 · [archivo](E12-2-tablero-kanban-elevadores.md) |
| E12‑3 | Como taller quiero líneas de piezas y mano de obra con IVA y totales correctos | T | Must | Construido | E12‑1 |
| E12‑4 | Como jefe de taller quiero asignar elevador sin conflictos | T | Must | Construido | E12‑1, E13‑5 |
| E12‑5 | Como taller quiero que al entregar el coche quede su intervención en el historial | T | Must | Construido | E12‑3 · [archivo](E12-5-entrega-orden-crea-intervencion.md) |
| E12‑6 | Como jefe de taller quiero ver las órdenes con retraso y las prometidas para hoy | T | Should | Construido | E12‑1 |
| E12‑7 | Como jefe de taller quiero ver mi taller en 3D con los coches en sus elevadores | T | Should | Construido | E12‑4, E14‑6 |
| E12‑8 | Como mecánico quiero ver solo mis órdenes | T | Should | A medias: solo hay un filtro "Mecánico" genérico, sin el atajo "Mis órdenes". Tarea propuesta 25 | E13‑2 |
| E12‑9 | Como taller quiero entregar al cliente un resumen imprimible de la orden | T | Could | Falta · **Decide Alberto (D12)** | Es lo que hoy ocupa el hueco de "Facturación". Tarea propuesta 24 |
| E12‑10 | Como taller quiero enviar un presupuesto y que el cliente lo apruebe online | T | Could | Falta | Fase 2; I12 |

**Criterios de aceptación**
- **E12‑1**: Dado un vehículo del taller, cuando abro una orden con título, y opcionalmente queja del cliente, prioridad, km de entrada, fecha prometida, mecánico y elevador, entonces se crea con número `OT-{año}-{0001}` (correlativo por espacio y año, **sin huecos ni duplicados en concurrencia**: test), estado `received`, hora de entrada y el cliente copiado del vehículo. Los km de entrada crean una lectura (`source = work_order`).
- **E12‑2**: ver [archivo](E12-2-tablero-kanban-elevadores.md).
- **E12‑3**: Dadas líneas con un IVA del 21 %, cuando guardo, entonces subtotal = Σ líneas, IVA = subtotal × 21 / 100 redondeado *half‑up* a 2 decimales y total = subtotal + IVA. Coincide con un caso de prueba calculado a mano (test). El IVA por defecto es el del espacio y se puede cambiar por orden.
- **E12‑4**: Dado el elevador 2 ocupado por una orden abierta, cuando asigno otra orden al 2, entonces recibo `409` "El elevador 2 está ocupado por OT‑…" y la UI lo muestra sin perder lo que estaba editando. Pasar a `ready`, `delivered` o `cancelled` libera el elevador salvo que indique otro. El elevador debe estar entre 1 y `bays_count`.
- **E12‑5**: ver [archivo](E12-5-entrega-orden-crea-intervencion.md).
- **E12‑6**: Dada una orden con fecha prometida pasada que no está lista, entregada ni cancelada, cuando veo el tablero o el dashboard, entonces aparece marcada "Con retraso" (icono + texto). El dashboard lista las prometidas para hoy (`due_today`) y las retrasadas (`late`).
- **E12‑7**: Dado el taller con 4 elevadores y 3 ocupados, cuando abro la vista 3D, entonces veo 4 elevadores numerados, los coches con su carrocería y color en los ocupados y hasta 8 en la zona de espera. Al seleccionar un elevador o un coche se abre su orden. **Existe la misma información en una lista HTML** (elevador → orden), y sin WebGL solo se muestra la lista.
- **E12‑8**: Dado un `mechanic` con órdenes asignadas, cuando activa "Mis órdenes", entonces el tablero filtra por `assigned_to` = él. Solo se puede asignar a miembros del espacio (`422` si no).
- **E12‑9**: Dada una orden, cuando pulso "Imprimir resumen", entonces se genera una hoja con datos del taller, cliente, vehículo, líneas y totales, rotulada **"Resumen de la orden — no es una factura"** (hasta que se decida D12).
- **E12‑10**: Dada una orden en `diagnosing`, cuando envío el presupuesto, entonces el cliente recibe un enlace para aprobarlo o rechazarlo, y queda constancia con la fecha. Necesita D13 y un ADR.

## E13 · Equipo, espacios y roles

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E13‑1 | Como usuario quiero crear un taller y cambiar entre "Mi garaje" y mis talleres | P+T | Must | Construido | E1 |
| E13‑2 | Como owner/manager quiero añadir a mi equipo con un rol | T | Must | Construido | E13‑1 |
| E13‑3 | Como owner/manager quiero cambiar roles o quitar miembros; como miembro, salir | T | Must | Construido | E13‑2 |
| E13‑4 | Como owner quiero que cada rol vea y haga solo lo que le corresponde | T | Must | Construido | E1‑5 |
| E13‑5 | Como owner/manager quiero configurar el taller (nombre, elevadores, IVA) | T | Must | Construido | E13‑1 |
| E13‑6 | Como owner quiero eliminar un taller | T | Should | Construido | E13‑1 |
| E13‑7 | Como owner/manager quiero ver quién hizo qué (actividad) | P+T | Should | A medias: solo las 10 últimas acciones, sin "ver más" ni filtro por vehículo. Tarea propuesta 25 | — |
| E13‑8 | Como owner/manager quiero invitar por email a alguien que aún no tiene cuenta | T | Could | Falta | Correo (D17); no está en el contrato v1 |

**Criterios de aceptación**
- **E13‑1**: Dado Ajustes → "Crear taller", cuando indico un nombre, entonces se crea un espacio `workshop` del que soy `owner` (`201`). El selector de espacio muestra mis espacios con su tipo y mi rol, y al cambiar, la navegación pasa del modo garaje al modo taller.
- **E13‑2**: Dado un email de un **usuario ya registrado**, cuando lo añado como `manager` o `mechanic`, entonces aparece en Miembros. Si no existe, veo "No existe ninguna cuenta con ese email" (`422`). En un espacio personal la API responde `409`.
- **E13‑3**: Dado un miembro, cuando cambio su rol o lo quito, entonces el cambio persiste. Cambiar el rol del último `owner` o quitarlo devuelve `409` con el motivo. Cualquier miembro puede salir de un espacio por sí mismo, salvo el último owner.
- **E13‑4**: Dada la matriz de permisos del contrato (§2), cuando un `mechanic` usa la app, entonces **no ve** los controles de archivar o borrar vehículos y clientes, gastos, analítica, ajustes ni miembros. `revenue` llega `null` y la API le responde `403` si los pide directamente. **Hay un test por capacidad y rol** (view, operate, manage, own).
- **E13‑5**: Dados los ajustes, cuando cambio el nº de elevadores (1‑12) o el IVA (0‑100), entonces el tablero y la vista 3D muestran ese nº de elevadores y las nuevas órdenes usan ese IVA. Fuera de rango ⇒ `422` junto al campo.
- **E13‑6**: Dado un taller, cuando su `owner` lo elimina escribiendo el nombre para confirmar, entonces se borra (`204`). Un manager no ve la acción. Un espacio personal no se puede eliminar (`409`).
- **E13‑7**: Dada actividad registrada, cuando abro "Actividad", entonces veo una lista paginada descendente con frases en español ("Ana movió OT‑2026‑0003 a «Listo»") y puedo filtrarla por vehículo. No aparecen datos sensibles.
- **E13‑8**: Dado un email sin cuenta, cuando lo invito, entonces recibe un enlace de un solo uso con caducidad para registrarse y unirse con el rol elegido.

## E14 · Experiencia 3D

*Reglas: ADR‑0004 y D16. Sin marcas ni modelos de terceros. Un solo `<Canvas>` por pantalla. El 3D nunca inventa datos.*

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E14‑1 | Como visitante quiero una portada 3D que me explique CarCare y me invite a registrarme | P+T | Should | Construido. Ojo: la portada anuncia "Facturación" (ver tarea propuesta 22) | — |
| E14‑2 | Como usuario quiero ver mi coche en 3D con su carrocería y su color | P+T | Must | Construido | — |
| E14‑3 | Como usuario quiero ver en vivo cómo queda el coche mientras lo doy de alta | P+T | Should | Construido | E14‑2 |
| E14‑4 | Como usuario curioso quiero una vista de rayos X ilustrativa | P+T | Could | Construido (interruptor "Rayos X · Ilustrativo" en el mapa de zonas) | E14‑2 |
| E14‑5 | Como usuario quiero listados rápidos con miniaturas del coche | P+T | Must | Construido | — |
| E14‑6 | Como usuario sin WebGL, con lector de pantalla o con movimiento reducido quiero la misma información | P+T | Must | Construido (sin probar con lector de pantalla) | — |
| E14‑7 | Como usuario con un equipo modesto quiero que el 3D vaya fluido y no ralentice la app | P+T | Must | En curso (tarea 20) | — |
| E14‑8 | Como usuario quiero un modo de iluminación nocturna | P+T | Could | A medias: la prop `lighting: 'night'` existe, pero ninguna pantalla la ofrece | Con la simplificación pedida, no se propone construirla |

**Criterios de aceptación**
- **E14‑1**: Dada la portada, cuando hago scroll, entonces la cámara y el color del coche siguen el progreso, y hay un CTA de registro visible sin scroll en 360 px. Con `prefers-reduced-motion` no hay animación ligada al scroll. Sin WebGL se ve la silueta. La portada **no muestra cifras ni funciones que no existan**.
- **E14‑2**: Dado un vehículo de cada una de las 9 carrocerías, cuando abro su ficha o el dashboard, entonces el modelo corresponde a su carrocería y se tiñe con `color_hex` (grafito si es null). En modo `showcase` rota despacio, salvo con movimiento reducido.
- **E14‑3**: Dado el alta o la edición, cuando cambio la carrocería o el color, entonces la vista previa se actualiza sin recargar y sin crear un segundo `<Canvas>` en la pantalla.
- **E14‑4**: Dado el visor, cuando activo "Rayos X", entonces la carrocería se vuelve translúcida, se ven componentes internos simplificados y aparece siempre el rótulo **"Ilustrativo"**. No se asocia a datos medidos.
- **E14‑5**: Dado un garaje con 20 vehículos (demo del taller), cuando lo abro, entonces las tarjetas usan imágenes estáticas cacheadas por (carrocería, color) y **no hay más de un contexto WebGL activo** en la página (comprobable en las herramientas del navegador).
- **E14‑6**: Dado un navegador sin WebGL, cuando abro cualquier pantalla con 3D, entonces veo la silueta SVG teñida y toda la información (zonas, elevadores) en HTML. El lienzo tiene `aria-label` descriptivo. Con `prefers-reduced-motion` no hay autorrotación ni vuelos de cámara. Los marcadores de zona se pueden usar con Tab y Enter.
- **E14‑7**: Dado el build de producción, cuando abro el login, entonces **no se descarga** el chunk de three.js (comprobable en Network). La escena quieta no repinta (`frameloop="demand"`) y el DPR está limitado a [1, 2]. El informe de experto‑3d indica el tamaño del chunk. **Objetivo a medir** (no es un resultado): ≥ 30 fps al orbitar en un portátil de referencia con gráfica integrada, que hay que definir (p. ej. el que se usará en la defensa).
- **E14‑8**: Dado el visor, cuando cambio a modo noche, entonces la iluminación cambia y los faros y pilotos se encienden, manteniendo el contraste de los marcadores de zona.

## E15 · Analítica de espacio

*Permiso `manage` (en personal, el owner). Un `mechanic` recibe `403`.*

| ID | Historia | Para | Prioridad | Estado | Depende de |
|----|----------|------|-----------|--------|------------|
| E15‑1 | Como particular quiero ver cuánto me cuestan todos mis coches y en qué | P | Must | En curso (tarea 17). Hoy la pantalla dice "Pantalla en preparación." | E4 |
| E15‑2 | Como dueño de un taller quiero ver el importe de lo entregado, el ticket medio y la estancia media | T | Should | Falta (la API ya da los datos; confirmar si entra en la tarea 17, si no es la tarea propuesta 23) | E12‑5; textos según D12 |
| E15‑3 | Como particular con varios coches quiero compararlos entre sí | P | Should | En curso (tarea 17) | E15‑1 |
| E15‑4 | Como usuario quiero exportar la analítica a CSV | P+T | Could | Falta | — |

**Criterios de aceptación**
- **E15‑1**: Dado un periodo (por defecto los últimos 12 meses), cuando abro la analítica del espacio personal, entonces veo el total, la evolución mensual, el reparto por vehículo y por categoría, y todo coincide con la suma de `expenses` (test).
- **E15‑2**: Dadas órdenes entregadas en el periodo, cuando abro la analítica del taller, entonces veo el importe total, el nº de órdenes entregadas, el ticket medio, los días medios en el taller y el reparto por cliente. Sin órdenes entregadas, ticket medio y estancia son null y se muestra "Aún no hay órdenes entregadas en este periodo". El rótulo es "Importe de órdenes entregadas" (D12), no "facturación".
- **E15‑3**: Dados 2 o más vehículos, cuando veo "Por vehículo", entonces cada uno muestra su total con miniatura, y al pulsar se abre su analítica.
- **E15‑4**: Dado un periodo filtrado, cuando pulso "Exportar CSV", entonces descargo exactamente las filas que suman las cifras mostradas.

---

## Definición de terminado

Una historia solo pasa a `Hecho` si cumple todo y hay un informe con evidencias:

- [ ] Flujo principal funciona con datos persistidos
- [ ] Autorización probada en backend (aislamiento entre espacios + permisos por rol)
- [ ] Validación en cliente y servidor
- [ ] Estados de carga, vacío y error
- [ ] Responsive (360, 768 y 1280 px)
- [ ] Accesible por teclado (y alternativa HTML si hay 3D)
- [ ] Tests pasando
- [ ] Limitaciones anotadas en el informe

## Fuera de este backlog

- **Fase 2, Fase 3, "solo investigar" y "fuera":** ver [`01_plan/plan-general.md` §4](../01_plan/plan-general.md).
- **Ideas nuevas:** primero a [`04_ideas/banco-ideas.md`](../04_ideas/banco-ideas.md).
