# 11. Manual de usuario

> **Estado: esqueleto.** La interfaz se está simplificando (tarea 16, paso 2, en curso el 26/10/2026), así que los nombres de los menús y la posición de los botones pueden cambiar. Este capítulo fija ya **qué tareas** se documentan, **en qué pantalla** se hacen (ruta de `frontend/src/app/router.tsx`) y **qué reglas** aplica el sistema, porque eso no depende del aspecto. Los pasos detallados y las capturas se escriben cuando la interfaz quede estable. [PENDIENTE: tarea 10 — redactar los pasos y hacer las capturas sobre la versión simplificada.]

## 11.1 Cómo usar este manual

El manual se organiza por **tareas del usuario**, no por pantallas: cada apartado responde a "quiero hacer X". Para cada tarea se indica:

- **Dónde:** la ruta de la pantalla. Todas las rutas internas empiezan por `/app/:ws`, donde `:ws` es el espacio de trabajo activo.
- **Quién:** el modo (particular o taller) y, en el taller, los roles que pueden hacerla.
- **Qué hace el sistema:** las reglas que el usuario va a notar (avisos, bloqueos, cálculos), con el requisito que las define (capítulo 4).
- **Captura:** el identificador de la figura prevista, que se lista en el §11.5.

Para seguirlo se pueden usar las cuentas de demostración del capítulo 10 (§10.5), todas con la contraseña `password`.

## 11.2 Tareas comunes a los dos modos

### Crear una cuenta y entrar

- **Dónde:** `/registro` y `/entrar`.
- **Qué hace el sistema:** al registrarse se crea siempre el espacio personal y, si se elige el registro como taller, también el espacio del taller (RF-03, CU-01). Tras cinco intentos fallidos en un minuto con el mismo email se bloquea temporalmente la entrada (RF-04). Si se abre una ruta privada sin sesión, lleva a la entrada y, al entrar, vuelve a la ruta pedida (RF-06).
- **Captura:** C-01.

> [PENDIENTE: captura tras la simplificación, tarea 10]

### Recuperar la contraseña

- **Dónde:** `/recuperar` y `/restablecer` (enlace "¿Has olvidado tu contraseña?" de la pantalla de entrada).
- **Qué hace el sistema:** responde lo mismo exista o no la cuenta; el enlace es de un solo uso y caduca a los 60 minutos (RF-10, ADR‑0006). En esta versión el correo no se envía: se escribe en el registro del servidor (D17 = A), así que en la demostración el enlace se copia de `backend/storage/logs/laravel.log`.
- **Estado:** la API está terminada y probada (`PasswordResetTest`, 13 pruebas). Las dos pantallas están en construcción el 26/10/2026 (tarea 28, paso 3).
- **Captura:** C-02.

> [PENDIENTE: captura tras la simplificación, tarea 10]

### Cambiar de espacio de trabajo

- **Dónde:** selector de espacio en la barra lateral.
- **Qué hace el sistema:** un usuario puede tener su espacio personal y pertenecer a uno o varios talleres; el menú cambia según el tipo de espacio y el rol (RF-11).
- **Captura:** C-03.

> [PENDIENTE: captura tras la simplificación, tarea 10]

### Buscar y lanzar acciones con el teclado

- **Dónde:** cualquier pantalla interna, con `Ctrl K`.
- **Qué hace el sistema:** abre una paleta con navegación y acciones rápidas (actualizar kilometraje, añadir gasto, nueva intervención, nuevo recordatorio, añadir vehículo y, en el taller, nueva orden y nuevo cliente), según los permisos del rol (`frontend/src/components/layout/CommandPalette.tsx`).
- **Captura:** C-04.

> [PENDIENTE: captura tras la simplificación, tarea 10]

### Gestionar la cuenta

- **Dónde:** `/app/ajustes`.
- **Qué hace el sistema:** permite cambiar el nombre y el email, cambiar la contraseña y darse de baja. La baja pide la contraseña y borra el espacio personal, sus ficheros y los talleres de los que el usuario es el único propietario; los talleres con otro propietario se conservan (RF-07…RF-09, RNF-12).
- **Captura:** C-05.

> [PENDIENTE: captura tras la simplificación, tarea 10]

### Usar la aplicación sin 3D o con movimiento reducido

- **Qué hace el sistema:** si el navegador no tiene WebGL, o mientras carga la escena, se muestra una silueta SVG; la información de las zonas está siempre también en HTML accesible (RF-49). Con la preferencia del sistema "reducir movimiento", las escenas no se animan (RNF-10).
- **Captura:** C-06 (misma ficha del vehículo con y sin WebGL).

> [PENDIENTE: captura tras la simplificación, tarea 10]

## 11.3 Modo particular

Cuenta de ejemplo: `demo@carcare.test`.

*Tabla 11.1. Tareas del modo particular.*

| # | Tarea | Dónde | Qué hace el sistema | Requisitos | Captura |
|---|-------|-------|---------------------|------------|---------|
| P-1 | Ver el estado general de mis vehículos | `/app/:ws` (panel de inicio) | Muestra vehículos, gasto, recordatorios y actividad, todo con datos guardados | RF-57 | C-10 |
| P-2 | Añadir un vehículo | `/app/:ws/vehiculos/nuevo` | Marca y modelo obligatorios; el resto aparece como "Sin indicar" si no se rellena. Vista previa del coche según carrocería y color | RF-17, RF-19, RF-50 | C-11 |
| P-3 | Apuntar los kilómetros | Ficha del vehículo, pestaña `diario`, o `Ctrl K` | Si el valor es menor que una lectura anterior, avisa y pide confirmación; el km actual es siempre la lectura más reciente | RF-23, RF-26, CU-03 | C-12 |
| P-4 | Apuntar un repostaje u otro gasto | Pestaña `gastos` | Once categorías; en un repostaje se pueden indicar cantidad y depósito lleno para calcular el consumo | RF-33, RF-38 | C-13 |
| P-5 | Registrar una reparación o un mantenimiento | `/app/:ws/vehiculos/:id/intervenciones/nueva` | Si tiene coste, crea a la vez un gasto vinculado: el importe no se apunta dos veces y ese gasto solo se edita desde la intervención | RF-27…RF-29, CU-02, ADR‑0003 | C-14 |
| P-6 | Consultar el historial | Pestaña `historial` | Línea temporal con filtros por tipo y zona | RF-30, RF-31 | C-15 |
| P-7 | Crear un recordatorio y marcarlo como hecho | Pestaña `recordatorios` y `/app/:ws/agenda` | Por fecha, por km o ambos; al completar uno recurrente se crea el siguiente | RF-41…RF-45, CU-04 | C-16 |
| P-8 | Ver qué zonas del coche tocan | Ficha del vehículo (vista 3D o lista) | Estado calculado a partir de los recordatorios, rotulado "según tus intervalos, no medido" | RF-46, RF-47, CU-05 | C-17 |
| P-9 | Guardar facturas y documentos | Pestaña `documentos` | PDF o imagen de hasta 10 MB; solo se descargan con la sesión iniciada | RF-53…RF-56 | C-18 |
| P-10 | Saber cuánto me cuesta el coche | Ficha del vehículo y `/app/:ws/analitica` | Coste por km solo con datos suficientes; si faltan, dice exactamente qué falta | RF-36, RF-37, RF-40, CU-10 | C-19 |
| P-11 | Preparar un informe para vender el coche | `/app/:ws/vehiculos/:id/informe` | Informe con fecha de generación, para imprimir o guardar en PDF desde el navegador | RF-59 | C-20 |

> [PENDIENTE: tarea 10 — redactar los pasos de P-1…P-11 sobre la interfaz simplificada; captura tras la simplificación, tarea 10.]

> [PENDIENTE: tarea 27, paso 3 — en P-3, explicar el enlace de cada lectura de km con su origen (intervención, gasto, orden o recordatorio) cuando la pestaña `diario` lo muestre. La API ya lo devuelve (`source_id`).]

## 11.4 Modo taller

Cuentas de ejemplo: `taller@carcare.test` (propietario), `gerente@carcare.test` (gerente) y `mecanico@carcare.test` (mecánico).

*Tabla 11.2. Tareas del modo taller y roles que pueden hacerlas.*

| # | Tarea | Dónde | Roles | Qué hace el sistema | Requisitos | Captura |
|---|-------|-------|-------|---------------------|------------|---------|
| T-1 | Crear un taller | `/app/ajustes` | Cualquier usuario (pasa a ser propietario) | Nombre, número de elevadores (1‑12) e IVA por defecto | RF-12, RF-13 | C-30 |
| T-2 | Añadir a una persona al equipo | `/app/:ws/equipo` | Propietario, gerente | Solo usuarios ya registrados, como gerente o mecánico | RF-15, CU-09 | C-31 |
| T-3 | Ver el día de un vistazo | `/app/:ws` (centro de control) | Todos | Contadores, órdenes por estado, elevadores, prometidas para hoy y retrasadas | RF-69 | C-32 |
| T-4 | Dar de alta un cliente y su coche | `/app/:ws/clientes` | Todos | Búsqueda de clientes; un cliente con órdenes abiertas no se puede borrar | RF-61 | C-33 |
| T-5 | Abrir una orden de trabajo | `/app/:ws/ordenes/nueva` | Todos | Número `OT-AAAA-nnnn` correlativo sin huecos; un elevador ocupado se rechaza diciendo por qué orden | RF-62, RF-66, CU-06, CU-08 | C-34 |
| T-6 | Mover una orden en el tablero | `/app/:ws/ordenes` | Todos | Arrastrar o usar el menú "Mover"; si el servidor rechaza el cambio, la tarjeta vuelve a su sitio | RF-63, RF-64, CU-11 | C-35 |
| T-7 | Añadir piezas y mano de obra | `/app/:ws/ordenes/:id` | Todos; el mecánico no ve importes | Subtotal, IVA y total calculados por el servidor | RF-16, RF-67 | C-36 |
| T-8 | Entregar el coche | `/app/:ws/ordenes/:id` | Todos | Al entregar se crea la intervención en el historial del vehículo | RF-65, CU-07 | C-37 |
| T-9 | Imprimir el resumen de la orden | `/app/:ws/ordenes/:id/resumen` | Todos; el mecánico lo imprime sin precios | Documento rotulado "No es una factura" | RF-71 | C-38 |
| T-10 | Ver qué elevadores están libres | `/app/:ws/taller` (vista 3D o lista) | Todos | Elevadores numerados con el coche de cada orden abierta y la zona de espera | RF-51 | C-39 |
| T-11 | Ver mis órdenes (mecánico) | `/app/:ws/ordenes` | Mecánico | Por defecto, solo las órdenes asignadas a él | RF-70 | C-40 |
| T-12 | Consultar la analítica del taller | `/app/:ws/analitica` | Propietario, gerente | No aparece en el menú del mecánico | RF-40 | C-41 |
| T-13 | Exportar o anonimizar a un cliente | `/app/:ws/clientes/:id` | Propietario, gerente | Exporta en JSON sus datos, vehículos y órdenes; anonimizar conserva el historial técnico de los vehículos | RF-72, RF-73, ADR‑0005 | C-42 |

> [PENDIENTE: tarea 10 — redactar los pasos de T-1…T-13 sobre la interfaz simplificada; captura tras la simplificación, tarea 10.]

> [PENDIENTE: tareas 24 y 29, paso 3 — T-9 y T-13 dependen de pantallas que `frontend-react` estaba cerrando el 26/10/2026. La API de T-13 está terminada y probada (`CustomerPrivacyTest`, 10 pruebas).]

> [PENDIENTE: tareas 33‑35 — si las solicitudes de reparación a talleres (E16) llegan a construirse antes de la entrega, añadir "Pedir presupuesto a un taller" en el modo particular y "Responder a una solicitud" en el modo taller.]

## 11.5 Capturas previstas

Todas se harán a 1280 px de ancho salvo que se indique otra cosa, con los datos de demostración puestos al día (`php artisan db:seed`) y sin datos personales reales.

*Tabla 11.3. Lista de capturas del manual de usuario.*

| Captura | Contenido | Cuenta | Estado |
|---------|-----------|--------|--------|
| C-01 | Pantalla de entrada | — | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-02 | Recuperar la contraseña: petición y nueva contraseña | — | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-03 | Selector de espacio con el personal y el taller | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-04 | Paleta de órdenes (`Ctrl K`) | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-05 | Ajustes de la cuenta | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-06 | Ficha del vehículo con 3D y con la silueta SVG | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-10 | Panel de inicio del particular (1280 y 360 px) | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-11 | Alta de vehículo con la vista previa | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-12 | Lectura de km con el aviso de retroceso | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-13 | Alta de un repostaje (360 px) | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-14 | Intervención con coste y su gasto vinculado | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-15 | Historial del vehículo | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-16 | Recordatorios y agenda | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-17 | Mapa de zonas con el rótulo "según tus intervalos, no medido" | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-18 | Documentos del vehículo | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-19 | Gastos, coste por km y analítica | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-20 | Informe del vehículo en vista de impresión | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-30 | Crear un taller desde Ajustes | `demo@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-31 | Equipo del taller | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-32 | Centro de control del taller | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-33 | Clientes y ficha de cliente | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-34 | Nueva orden con el aviso de elevador ocupado | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-35 | Tablero de órdenes | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-36 | Detalle de la orden con líneas e IVA | `gerente@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-37 | Entrega de la orden y la intervención creada | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-38 | Resumen imprimible "No es una factura" (con y sin precios) | `taller@`, `mecanico@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-39 | Taller en 3D y su lista equivalente | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-40 | "Mis órdenes" del mecánico | `mecanico@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-41 | Analítica del taller | `gerente@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |
| C-42 | Exportar y anonimizar un cliente | `taller@` | > [PENDIENTE: captura tras la simplificación, tarea 10] |

Las capturas se numerarán como figuras del capítulo (Figura 11.1, 11.2…) en el orden en que aparezcan en el texto definitivo.
