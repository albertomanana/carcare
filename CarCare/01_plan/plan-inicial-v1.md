# CarCare: auditoría y plan inicial

*Versión 1 · 20 de octubre de 2026 · Estado: propuesta pendiente de aprobación. No se ha creado repositorio ni código.*

---

## 0. Decisiones que necesito de ti

Antes de crear el repositorio necesito estas respuestas. Marco mi recomendación en cada una.

| # | Decisión | Opciones | Recomendación |
|---|----------|----------|---------------|
| D1 | Normativa oficial del TFG | La plantilla subida es de la **URJC** (Fac. CC. Económicas y Empresariales, 23‑24), no de Ilerna/DAW. ¿Tienes la guía del módulo de Proyecto de Ilerna para tu convocatoria? | Conseguir la guía de Ilerna del curso 26‑27 antes de fijar la estructura de la memoria. Mientras tanto, la arquitectura no depende de ella salvo que imponga tecnologías. |
| D2 | Forma de la aplicación | **A)** Laravel como API REST + React SPA separada · **B)** Laravel + Inertia + React (una sola app) | **A**, si Ilerna no lo impide (ver §2.2). |
| D3 | Gastos e intervenciones | **A)** Cada intervención con coste genera un gasto vinculado · **B)** Tablas independientes y el usuario apunta dos veces | **A**: una sola fuente para sumar, sin doble conteo (ver §3.3). |
| D4 | Imagen del vehículo en el MVP | **A)** Silueta SVG por carrocería, teñida con el color del coche · **B)** Foto subida por el usuario | **A** en el MVP; foto propia en fase 2 junto al almacenamiento privado de documentos. |
| D5 | Hosting del repositorio | GitHub (público o privado) | GitHub privado; conectarlo en ajustes del proyecto para que pueda trabajar en él. |
| D6 | Calendario | Fecha de entrega y defensa | Dímela y ajusto el backlog a sprints reales. No he inventado fechas. |

---

## 1. Auditoría del estado actual

**Repositorio y código:** no existen. No hay rama, cambios sin commit, rutas, componentes ni base de datos que auditar. El proyecto parte de cero, como confirmaste.

**Documentación disponible** (en la carpeta del proyecto):

| Archivo | Qué aporta | Observaciones |
|---------|-----------|---------------|
| `Car_Care_Documentacion_Inicial.zip` (8 ficheros) | Visión, módulos con criterios de aceptación, dirección UI y paleta, arquitectura y entidades candidatas, roadmap en 5 fases, entregables académicos, reglas de trabajo | Coherente. Deja abierta la cuestión del doble conteo gasto/intervención (D3). Lo he usado como base de este plan. |
| `Anexos_Normas_TFG_… 23-24 FCEE.docx` | Modelo de portada y estilos de la memoria | **Contradicción:** lleva el escudo de la Universidad Rey Juan Carlos, dice “Grado en …” y es del curso 23‑24. DAW es un ciclo formativo de grado superior, no un grado universitario. Solo contiene portada y estilos (Times New Roman, márgenes 2,5 cm, títulos 0‑4); **no incluye requisitos técnicos, rúbrica, extensión ni fechas.** |
| 4 imágenes de referencia | Dirección visual | Analizadas en §4.1. Varias muestran datos que exigen OBD o telemática. |

**Requisitos de Ilerna:** no los tengo. No he inventado ninguno. Todo lo que dependa de ellos aparece marcado con ⚠️ *Depende de Ilerna*.

---

## 2. Arquitectura recomendada

### 2.1 Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Frontend | **React 19 + TypeScript + Vite** | Tipado que reduce errores en formularios y contratos de API; Vite da arranque y build rápidos. |
| Estilos | **Tailwind CSS v4** con tokens propios (CSS variables) | Los tokens del §4 se definen una vez y Tailwind los consume; facilita modo claro futuro. |
| Componentes accesibles | **Radix UI primitives** (diálogo, menú, select, tabs, tooltip) | Foco, teclado y ARIA resueltos; el aspecto lo ponemos nosotros. Evita una librería de componentes completa. |
| Datos en cliente | **TanStack Query** + `fetch` tipado | Caché, estados de carga/error y revalidación sin escribir un store a mano. |
| Formularios | **React Hook Form + Zod** | Validación en cliente con los mismos mensajes que el backend; esquemas reutilizables. |
| Rutas | **React Router** | Estándar, suficiente para una SPA de este tamaño. |
| Gráficos | **Recharts** | Candidata del proyecto; cubre barras, áreas y donut. |
| Animación | **Motion** (antes Framer Motion) | Transiciones de layout y entrada; respeta `prefers-reduced-motion`. |
| Backend | **Laravel 12 (PHP 8.3+)** | Validación (Form Requests), autorización (Policies), migraciones, Eloquent, hashing y protección CSRF probados. Defendible en DAW. |
| Autenticación | **Laravel Sanctum en modo SPA** (cookie de sesión + CSRF) | Sin tokens en `localStorage`; misma sesión segura que una web clásica. |
| Base de datos | **MySQL 8** | Candidata del proyecto; integridad referencial, `DECIMAL`, índices. |
| Archivos (fase 2) | Disco privado de Laravel (`storage/app/private`), descarga por controlador autorizado | Nunca rutas públicas predecibles. Migrable a S3 compatible. |
| Pruebas | **Pest/PHPUnit** (backend), **Vitest + Testing Library** (frontend), **Playwright** (flujos E2E) | Cada capa prueba lo suyo; Playwright ya funciona en este entorno. |
| Calidad | ESLint, Prettier, Laravel Pint, PHPStan (Larastan) nivel moderado | Errores detectados antes de revisión. |
| Entorno local | **Docker Compose** (PHP, MySQL, Node) o Laravel Herd | ⚠️ Confirmar qué usas en tu equipo. |
| CI | GitHub Actions: lint + tests en cada PR | Evidencia objetiva para la memoria. |

### 2.2 Forma de la aplicación (D2)

```
┌──────────────── navegador ────────────────┐
│ React SPA (Vite)                          │
│  páginas → hooks TanStack Query → api.ts  │
└───────────────┬───────────────────────────┘
                │ HTTPS · JSON · cookie Sanctum + XSRF
┌───────────────▼───────────────────────────┐
│ Laravel API  /api/v1/...                  │
│  Rutas → Form Request (validación)        │
│        → Policy (¿es tuyo?)               │
│        → Controller → Service (reglas)    │
│        → Eloquent → MySQL                 │
│        → API Resource (respuesta JSON)    │
└───────────────────────────────────────────┘
```

**Opción A (recomendada): API REST + SPA separada en un monorepo** (`/backend`, `/frontend`).
- A favor: separación cliente/servidor clara y explicable en la defensa; la API documentada es en sí un entregable; sirve después para app móvil, extracción de facturas o el asistente.
- En contra: algo más de configuración (CORS/dominio compartido, CSRF de Sanctum).

**Opción B: Laravel + Inertia + React.**
- A favor: menos fontanería, autenticación de sesión directa, un solo despliegue.
- En contra: no hay API pública reutilizable; la frontera cliente/servidor es menos visible para el tribunal.

⚠️ *Depende de Ilerna*: si la guía exige PHP “sin framework” o prohíbe frameworks concretos, cambiaría a una API PHP propia con PDO, manteniendo el mismo modelo de datos y el mismo frontend.

### 2.3 Principios técnicos

- **Autorización en servidor siempre.** Cada recurso hijo (intervención, gasto…) se resuelve a través de un vehículo del usuario autenticado. Policies + rutas anidadas (`/vehicles/{vehicle}/maintenance`) y *scoping* de Eloquent. Prueba automática de “usuario B no puede leer/editar recursos de A” por cada endpoint.
- **Dinero en `DECIMAL(10,2)`**, moneda EUR fija en el MVP (columna `currency` preparada).
- **Kilometraje entero ≥ 0**; avisos ante retrocesos (no bloqueo, porque hay cambios de cuadro y errores de tecleo legítimos, pero se pide confirmación).
- **Archivar en vez de borrar** (`archived_at`) para vehículos e intervenciones; borrado definitivo solo con confirmación explícita.
- **Ninguna cifra inventada**: si faltan datos, la UI dice “faltan datos para calcular esto” y propone la acción que lo resuelve.
- **Versionado de API** (`/api/v1`) y respuestas de error uniformes (`{ message, errors }`, sin trazas).

---

## 3. Modelo de datos inicial (MVP)

### 3.1 Diagrama entidad‑relación

```
users 1───N vehicles 1───N maintenance_records 1───N maintenance_items
                 │                 │
                 │                 └──0..1── expenses (maintenance_record_id UNIQUE)
                 ├───N expenses
                 └───N mileage_logs
```

Fase 2 añade `reminders` (N por vehículo) y `documents` (N por vehículo, opcionalmente ligados a una intervención o gasto).

### 3.2 Tablas

**users**
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | BIGINT PK | |
| name | VARCHAR(100) | obligatorio |
| email | VARCHAR(255) | único, obligatorio |
| password | VARCHAR(255) | hash bcrypt/argon2 del framework |
| email_verified_at | TIMESTAMP NULL | verificación opcional en MVP |
| locale | VARCHAR(5) | por defecto `es` |
| created_at / updated_at | TIMESTAMP | |

**vehicles**
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | BIGINT PK | |
| user_id | FK → users | índice, `ON DELETE CASCADE` |
| nickname | VARCHAR(60) NULL | “El Ibiza de casa” |
| make | VARCHAR(60) | obligatorio (lista sugerida, texto libre permitido) |
| model | VARCHAR(80) | obligatorio |
| version | VARCHAR(120) NULL | generación/acabado |
| year | SMALLINT NULL | 1900 … año actual + 1 |
| fuel_type | ENUM NULL | gasolina, diésel, híbrido, híbrido enchufable, eléctrico, GLP, GNC, otro |
| transmission | ENUM NULL | manual, automático |
| engine | VARCHAR(60) NULL | “1.6 TDI 115 CV” |
| body_type | ENUM NULL | utilitario, berlina, familiar, SUV, monovolumen, coupé, cabrio, pick‑up, furgoneta (para la silueta, D4) |
| color_hex | CHAR(7) NULL | para teñir la silueta |
| plate | VARCHAR(15) NULL | normalizado en mayúsculas sin espacios; único por usuario si existe |
| vin | CHAR(17) NULL | 17 caracteres sin I/O/Q; único por usuario si existe |
| purchase_date | DATE NULL | |
| purchase_mileage | INT UNSIGNED NULL | base para coste/km |
| current_mileage | INT UNSIGNED NULL | se mantiene desde `mileage_logs` (ver reglas) |
| archived_at | TIMESTAMP NULL | |
| created_at / updated_at | TIMESTAMP | |

**maintenance_records** (intervenciones: mantenimiento, reparación, avería, revisión, ITV, neumáticos, otro)
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | BIGINT PK | |
| vehicle_id | FK → vehicles | índice compuesto `(vehicle_id, service_date)` |
| type | ENUM | maintenance, repair, breakdown, inspection, tyres, other |
| title | VARCHAR(120) | obligatorio (“Cambio de aceite y filtro”) |
| description | TEXT NULL | |
| service_date | DATE | no futura |
| mileage | INT UNSIGNED NULL | |
| workshop_name | VARCHAR(120) NULL | texto libre en el MVP |
| parts_cost | DECIMAL(10,2) NULL | ≥ 0; derivado de líneas si existen |
| labor_cost | DECIMAL(10,2) NULL | ≥ 0 |
| total_cost | DECIMAL(10,2) NULL | ≥ 0; si hay desglose, total = piezas + mano de obra (+ IVA si se indica) |
| currency | CHAR(3) | `EUR` |
| archived_at | TIMESTAMP NULL | |
| created_at / updated_at | TIMESTAMP | |

**maintenance_items** (desglose opcional de piezas y mano de obra)
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | BIGINT PK | |
| maintenance_record_id | FK → maintenance_records | `ON DELETE CASCADE` |
| kind | ENUM | part, labor, fluid, other |
| name | VARCHAR(120) | “Filtro de aceite” |
| part_number | VARCHAR(60) NULL | referencia |
| quantity | DECIMAL(8,2) | > 0, por defecto 1 |
| unit_price | DECIMAL(10,2) NULL | ≥ 0 |

**expenses**
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | BIGINT PK | |
| vehicle_id | FK → vehicles | índice `(vehicle_id, expense_date)` |
| maintenance_record_id | FK NULL, **UNIQUE** | si existe, el gasto lo gestiona la intervención (solo lectura en la pantalla de gastos) |
| category | ENUM | fuel, maintenance, repair, insurance, tax, inspection, parking, tolls, cleaning, fines, other |
| description | VARCHAR(160) NULL | |
| amount | DECIMAL(10,2) | > 0 |
| currency | CHAR(3) | `EUR` |
| expense_date | DATE | no futura |
| mileage | INT UNSIGNED NULL | |
| liters | DECIMAL(6,2) NULL | solo combustible; habilita consumo medio más adelante |
| created_at / updated_at | TIMESTAMP | |

**mileage_logs**
| Campo | Tipo | Reglas |
|-------|------|--------|
| id | BIGINT PK | |
| vehicle_id | FK → vehicles | índice `(vehicle_id, recorded_at)` |
| recorded_at | DATE | |
| mileage | INT UNSIGNED | |
| source | ENUM | manual, maintenance, expense, vehicle_created |
| source_id | BIGINT NULL | id del registro de origen |
| created_at | TIMESTAMP | |

Usuarios: `user_id` no se duplica en tablas hijas; la propiedad se comprueba a través del vehículo (una sola fuente de verdad, sin columnas que puedan desincronizarse).

### 3.3 Reglas de negocio clave

1. **Sin doble conteo (D3‑A):** al guardar una intervención con `total_cost`, un servicio crea o actualiza en la misma transacción su gasto vinculado (categoría `maintenance` o `repair` según el tipo). Al archivar la intervención, el gasto deja de contar. Todos los totales salen solo de `expenses`.
2. **Kilometraje:** cada registro con `mileage` añade un `mileage_log`. `current_mileage` = máximo kilometraje registrado. Si un nuevo valor es menor que el anterior en una fecha posterior, la API exige `confirm_mileage_drop=true`.
3. **Coste por kilómetro:** solo se muestra si hay al menos dos lecturas de kilometraje separadas ≥ 500 km y ≥ 30 días en el periodo. Fórmula: suma de gastos del periodo ÷ (km final − km inicial). Si no se cumple, se indica qué falta.
4. **Archivado:** un vehículo archivado desaparece del selector y del dashboard pero conserva su historial; se puede restaurar.

### 3.4 API v1 (borrador)

| Método y ruta | Uso |
|---------------|-----|
| `POST /register`, `POST /login`, `POST /logout`, `GET /sanctum/csrf-cookie` | Autenticación |
| `GET/PATCH /api/v1/me`, `PUT /api/v1/me/password`, `DELETE /api/v1/me` | Perfil, contraseña, baja |
| `GET/POST /api/v1/vehicles`, `GET/PATCH/DELETE /api/v1/vehicles/{id}`, `POST …/{id}/archive`, `POST …/{id}/restore` | Garaje |
| `GET/POST /api/v1/vehicles/{id}/maintenance`, `GET/PATCH/DELETE /api/v1/maintenance/{id}` | Intervenciones (con `items[]`) |
| `GET/POST /api/v1/vehicles/{id}/expenses`, `PATCH/DELETE /api/v1/expenses/{id}` | Gastos (filtros `from`, `to`, `category`) |
| `GET/POST /api/v1/vehicles/{id}/mileage` | Lecturas de kilometraje |
| `GET /api/v1/vehicles/{id}/summary?from&to` | Datos agregados para dashboard y analítica |

Documentación con OpenAPI (generada con Scribe o escrita a mano) como anexo de la memoria.

---

## 4. Sistema visual

### 4.1 Qué tomamos de las referencias y qué no

| Referencia | Tomamos | No podemos mostrar en el MVP (y por qué) |
|-----------|---------|------------------------------------------|
| App Kia oscura | Tarjetas oscuras de radio amplio, barras de progreso por consumible, gráfico de gasto mensual con valor resaltado, navegación inferior en móvil | **Safe Driving Score** y **% de vida de consumibles** medidos: requieren telemática u OBD. “Book a maintenance”, mapa, tienda y control remoto: no existen. |
| Web “care.” | Barra lateral con iconos, **selector de vehículos en carrusel**, coche protagonista grande, tarjeta “próximo mantenimiento”, tabla de historial, KPI pequeños (último servicio, total servicios) | **Health indicators** (bujías, pastillas, temperatura, batería): requieren sensores. Proveedores cercanos y “Book service”: sin integración. |
| App “Garage” negra | Tipografía display enorme, selector de marca con buscador, **trío de KPI** (km, próximo servicio, gasto del año), píldora de aviso, nav inferior flotante | **Health score 89 %**: no hay base para calcularlo sin sensores. Lo prohíbe además la documentación del proyecto. |
| Dashboard aseguradora (claro) | Gráfico de área con tooltip, filtros de periodo, versión móvil apilada, lista de componentes con estado | Niveles de fluidos, presión de neumáticos, viajes y consumo diario: datos de telemática. |

**Alternativa honesta a la “salud”** (fase 2, con recordatorios): una lista de **“estado de mantenimiento”** calculada con reglas explícitas que define el usuario (p. ej., aceite cada 15.000 km o 12 meses). Cada fila dice “último: 12/03/2026 a 84.200 km · próximo: a 99.200 km o 12/03/2027” y su barra de progreso refleja tiempo/km transcurridos, no el desgaste real. La etiqueta lo deja claro: *“según tus intervalos, no medido”*. En el MVP ya mostramos datos factuales: “Último cambio de aceite: hace 7 meses, 6.300 km”.

### 4.2 Tokens de color (modo oscuro por defecto)

Contrastes calculados con la fórmula WCAG 2.x.

| Token | Valor | Uso | Contraste |
|-------|-------|-----|-----------|
| `--bg` | `#111518` | fondo de página | |
| `--surface-1` | `#1A2024` | tarjetas | |
| `--surface-2` | `#20272B` | tarjetas elevadas, inputs | |
| `--surface-3` | `#2A3237` | hover, filas seleccionadas | |
| `--border` | `#333B40` | bordes sutiles (decorativos) | 1,6:1 (no apto para bordes de inputs) |
| `--border-strong` | `#5B666C` | borde de inputs y controles | 3,1:1 sobre `--bg` ✔︎ (≥ 3:1 para UI) |
| `--text` | `#F5F7F7` | texto principal | 17,1:1 sobre `--bg`, 14,1:1 sobre `--surface-2` ✔︎ |
| `--text-warm` | `#F2EFE8` | titulares (blanco cálido) | 16,0:1 sobre `--bg` ✔︎ |
| `--text-muted` | `#A5B0B5` | texto secundario | 8,3:1 / 6,8:1 ✔︎ |
| `--text-subtle` | `#8A969C` | metadatos, ejes de gráficos | 5,0:1 sobre `--surface-2` ✔︎ |
| `--accent` | `#C7F36B` | CTA principal, foco, dato destacado | 14,4:1 sobre `--bg` ✔︎ |
| `--on-accent` | `#111518` | texto sobre lima | 14,4:1 ✔︎ |
| `--accent-soft` | `rgba(199,243,107,.12)` | fondos de píldoras y selección | |
| `--danger` | `#FF6B6B` | errores, vencido | 5,5:1 sobre `--surface-2` ✔︎ |
| `--warning` | `#F5B84A` | próximo a vencer | 8,5:1 ✔︎ |
| `--info` | `#7CC4FA` | neutro informativo | a verificar en prototipo |

Reglas: la lima es un **acento**, no un relleno de fondo de áreas grandes; una sola acción primaria lima por pantalla. El estado nunca se comunica solo por color (icono + texto). Paleta de gráficos: lima para la serie principal, y una escala neutra de grises cálidos + 3 tonos de apoyo (cian `#5CD6C0`, ámbar `#F5B84A`, lavanda `#B4A7F5`) para categorías; se validará en prototipo. Modo claro: fuera del MVP, pero los tokens lo permiten.

### 4.3 Tipografía

- **Inter** (variable, autoalojada) para UI y texto; **cifras tabulares** (`font-variant-numeric: tabular-nums`) en importes y kilómetros.
- **Space Grotesk** o **Manrope** para titulares display y cifras grandes de KPI (a elegir en prototipo).
- Escala: 12 · 14 · 16 (base) · 18 · 20 · 24 · 30 · 36 · 48 · 64 px. Interlineado 1,5 en texto, 1,1 en display.
- Formatos: `12.450 km`, `1.234,56 €`, `20 oct 2026` (Intl con locale `es-ES`).

### 4.4 Forma, espacio y movimiento

- Espaciado base 4 px (4, 8, 12, 16, 24, 32, 48, 64).
- Radios: 8 (inputs, botones), 16 (tarjetas), 24 (tarjeta héroe del vehículo), 999 (píldoras).
- Altura de controles: 40 px escritorio, 44 px táctil mínimo.
- Sombras casi nulas en oscuro; elevación por cambio de superficie y un borde de 1 px.
- Movimiento: 150 ms (hover/focus), 220 ms (entrada de tarjetas), 300 ms (cambio de vehículo con transición del coche). Curva `cubic-bezier(.2,.8,.2,1)`. Con `prefers-reduced-motion` se sustituye por fundido instantáneo.
- Foco visible: anillo de 2 px lima con separación de 2 px.

### 4.5 Componentes base

AppShell (barra lateral escritorio / nav inferior móvil) · VehicleSwitcher (carrusel con teclado) · VehicleHero (silueta + datos) · StatCard · Button (primario, secundario, fantasma, peligro) · Input, Select, DateField, MoneyField, MileageField con error en línea · Dialog y ConfirmDialog · Toast · Tabs · Badge/StatusPill · Timeline (intervenciones) · DataTable con filtros · ChartCard (barras, área, donut) · EmptyState · Skeleton · ErrorState.

---

## 5. Backlog MVP con criterios de aceptación

Prioridad MoSCoW. Cada historia se cierra solo si cumple la “definición de terminado” del §5.7.

### E0. Base del proyecto
| ID | Historia | Criterios de aceptación |
|----|----------|-------------------------|
| E0‑1 | Como desarrollador quiero un monorepo con backend y frontend arrancables con un comando | `README` con instalación; `docker compose up` (o equivalente) levanta API, MySQL y Vite; `/api/v1/health` responde 200. |
| E0‑2 | CI con lint y tests | Un PR ejecuta Pint, PHPStan, ESLint, tsc, Pest y Vitest; falla si alguno falla. |
| E0‑3 | Tokens y componentes base | Página interna `/ui` (solo en desarrollo) muestra botones, inputs, tarjetas, estados vacío/carga/error con los tokens; foco visible por teclado. |

### E1. Autenticación y perfil (Must)
| ID | Historia | Criterios de aceptación |
|----|----------|-------------------------|
| E1‑1 | Registrarme con nombre, email y contraseña | Email único y válido; contraseña ≥ 8 caracteres; errores junto al campo; tras registrarme entro al onboarding. |
| E1‑2 | Iniciar y cerrar sesión | Credenciales erróneas muestran mensaje genérico; 5 intentos fallidos por minuto → bloqueo temporal (rate limit); al cerrar sesión, volver atrás no muestra datos privados. |
| E1‑3 | Rutas protegidas | Sin sesión, cualquier ruta privada redirige a login y vuelve a la ruta pedida tras entrar; la API devuelve 401. |
| E1‑4 | Editar perfil y cambiar contraseña | Cambiar contraseña exige la actual; cambios persisten tras recargar. |
| E1‑5 | Aislamiento de datos | Test automático: el usuario B recibe 404/403 al pedir, editar o borrar cualquier recurso del usuario A, para cada endpoint. |
| E1‑6 | (Should) Recuperar contraseña por email | Enlace de un solo uso con caducidad; en desarrollo el email se ve en Mailpit. |
| E1‑7 | (Should) Eliminar mi cuenta | Confirmación con contraseña; se eliminan sus vehículos y registros. |

### E2. Garaje (Must)
| ID | Historia | Criterios de aceptación |
|----|----------|-------------------------|
| E2‑1 | Añadir mi primer vehículo en un formulario por pasos | Paso 1 obligatorio: marca, modelo; paso 2 opcional: año, combustible, cambio, motor, carrocería, color; paso 3 opcional: matrícula, VIN, km actuales, fecha y km de compra. Puedo terminar tras el paso 1. Validaciones de año, VIN y matrícula. |
| E2‑2 | Ver la lista de mis vehículos | Tarjetas con silueta, nombre, matrícula y km; vacío con CTA “Añadir vehículo”; solo veo los míos. |
| E2‑3 | Ver la ficha de un vehículo | Datos, km actuales con fecha de lectura, accesos a historial y gastos; los campos no informados aparecen como “Sin indicar”, nunca inventados. |
| E2‑4 | Editar un vehículo | Cambios persisten; errores de validación en línea. |
| E2‑5 | Archivar y restaurar | Archivar pide confirmación; el vehículo sale del selector y del dashboard; puede restaurarse desde “Archivados”. |
| E2‑6 | Registrar una lectura de kilometraje rápida | Desde la ficha o el dashboard; un valor menor que el último pide confirmación. |
| E2‑7 | (Could) Eliminar definitivamente | Solo desde archivados, escribiendo el nombre del vehículo para confirmar. |

### E3. Mantenimiento y reparaciones (Must)
| ID | Historia | Criterios de aceptación |
|----|----------|-------------------------|
| E3‑1 | Registrar una intervención | Tipo, título, fecha (no futura) obligatorios; km, taller, descripción, costes opcionales; importes ≥ 0 con 2 decimales; queda asociada al vehículo correcto. |
| E3‑2 | Desglosar piezas y mano de obra | Puedo añadir/quitar líneas; el total se recalcula; si edito el total a mano y no cuadra con el desglose, se avisa. |
| E3‑3 | Ver el historial como línea temporal | Ordenado por fecha desc. (desempate por km); agrupado por año; filtros por tipo y año; buscador por título/taller. |
| E3‑4 | Ver el detalle de una intervención | Todos los campos y líneas; acciones editar/archivar. |
| E3‑5 | Editar y archivar | Persisten; al archivar, su gasto vinculado deja de sumar. |
| E3‑6 | Gasto automático | Al guardar con coste, aparece en Gastos como “desde intervención”, no editable allí, con enlace a la intervención; los totales no lo cuentan dos veces (test). |
| E3‑7 | Kilometraje coherente | Si informo km, actualiza los km del vehículo si es mayor; si es menor que una lectura posterior, se avisa. |

### E4. Gastos y analítica (Must)
| ID | Historia | Criterios de aceptación |
|----|----------|-------------------------|
| E4‑1 | Registrar un gasto | Categoría, importe > 0, fecha obligatorios; litros solo visibles en combustible; km opcional. |
| E4‑2 | Listar y filtrar gastos | Filtros por periodo (mes, trimestre, año, personalizado) y categoría; la URL conserva los filtros. |
| E4‑3 | Ver totales y gráficos | Total del periodo, por categoría (donut) y por mes (barras); al cambiar filtros cambian **cifras y gráficos a la vez**; con datos de prueba conocidos los totales coinciden exactamente (test). |
| E4‑4 | Coste por kilómetro | Visible solo con datos suficientes (§3.3, regla 3); si no, mensaje que explica qué falta. |
| E4‑5 | Editar y eliminar gastos manuales | Confirmación al eliminar; los gastos vinculados a intervenciones no se pueden eliminar aquí. |
| E4‑6 | (Should) Comparar con el periodo anterior | Variación en % solo si el periodo anterior tiene datos. |

### E5. Dashboard (Must)
| ID | Historia | Criterios de aceptación |
|----|----------|-------------------------|
| E5‑1 | Ver el vehículo seleccionado como protagonista | Selector de vehículo (se recuerda el último); silueta, nombre, km actuales. |
| E5‑2 | KPI reales | Gasto del mes y del año, nº de intervenciones, última intervención (fecha y km). Cada cifra sale de la API `summary`. |
| E5‑3 | Historial reciente | Últimas 5 intervenciones con enlace a cada una y a “ver todo”. |
| E5‑4 | Gasto de los últimos 12 meses | Gráfico de barras con mes actual resaltado y tooltip. |
| E5‑5 | “Desde el último…” | Datos factuales: último cambio de aceite / revisión / ITV registrados, con tiempo y km transcurridos; si no hay, “Sin registros” y CTA. |
| E5‑6 | Accesos rápidos | Añadir intervención, añadir gasto, actualizar km; cada uno abre el formulario con el vehículo preseleccionado. |
| E5‑7 | Estados vacíos | Sin vehículos → onboarding; vehículo sin datos → tarjeta guía con los 3 primeros pasos. |

### E6. Calidad y entregables (Must)
| ID | Historia | Criterios de aceptación |
|----|----------|-------------------------|
| E6‑1 | Seeders de demostración | `php artisan db:seed --class=DemoSeeder` crea un usuario demo con 2 vehículos y 18 meses de historial claramente ficticio; nunca se ejecuta en producción. |
| E6‑2 | E2E del recorrido principal | Playwright: registro → añadir vehículo → intervención → gasto → dashboard muestra los totales esperados, en escritorio y móvil. |
| E6‑3 | Accesibilidad | Auditoría axe sin errores críticos en las pantallas MVP; navegación completa con teclado. |
| E6‑4 | Documentación técnica | README, OpenAPI, diagrama E‑R, decisiones de arquitectura (ADR) en `/docs`. |

### 5.7 Definición de terminado (por historia)
Flujo principal funciona con datos persistidos · autorización probada en backend · validación en cliente y servidor · estados de carga, vacío y error · responsive (360 px, 768 px, 1280 px) · accesible por teclado · tests pasando en CI · limitaciones anotadas.

### 5.8 Orden de entrega propuesto
1. E0 (base, tokens, CI)
2. E1 (auth) + E1‑5 desde el primer endpoint
3. E2 (garaje)
4. E3 (intervenciones) con E3‑6
5. E4 (gastos y analítica)
6. E5 (dashboard), que consume lo anterior
7. E6 a lo largo de todo, cierre con E2E y documentación

Cada punto es una entrega pequeña revisable (una PR o pocas), con resumen de archivos, pruebas ejecutadas y limitaciones.

### 5.9 Fuera del MVP
- **Fase 2:** recordatorios por fecha/km y estado de mantenimiento por reglas; ITV/seguro; documentos privados y foto del vehículo; exportar historial a PDF; notificaciones por email; modo claro.
- **Fase 3:** extracción asistida de facturas con revisión humana; asistente sobre los datos reales del usuario.
- **Investigación posterior:** OBD‑II, consulta de matrícula/VIN con proveedores autorizados, reserva en talleres, vehículos compartidos, portal profesional.
- **Descartado de las referencias:** puntuación de conducción, salud de piezas medida, niveles de fluidos, presión de neumáticos, viajes, tiempo/meteo, mapas, tienda, control remoto.

---

## 6. Plan de pantallas

| # | Pantalla | Móvil (< 768 px) | Escritorio (≥ 1024 px) | Estados especiales |
|---|----------|------------------|------------------------|--------------------|
| 1 | Bienvenida (landing mínima) | Hero con titular display, CTA registrar/entrar | Hero a dos columnas con captura real de la app | — |
| 2 | Registro / Login | Formulario a pantalla completa | Tarjeta centrada sobre fondo con silueta | errores en línea, bloqueo por intentos |
| 3 | Onboarding: primer vehículo | Pasos con barra de progreso, selector de marca con buscador (estilo ref. “Garage”) | Igual en tarjeta ancha con vista previa de la silueta en vivo | saltar pasos opcionales |
| 4 | Dashboard | Nav inferior; héroe del vehículo; carrusel de KPI horizontal; “desde el último…”; gráfico; recientes | Barra lateral; fila superior con selector de vehículos (ref. “care.”); héroe grande a la izquierda + KPI a la derecha; debajo gráfico 12 meses y recientes | sin vehículos, vehículo sin datos, carga skeleton |
| 5 | Garaje | Lista de tarjetas | Rejilla de tarjetas; pestaña “Archivados” | vacío, archivados |
| 6 | Ficha del vehículo | Héroe + secciones plegables | Héroe + pestañas (Resumen, Historial, Gastos, Datos) | campos sin indicar |
| 7 | Historial (línea temporal) | Línea vertical con tarjetas, filtros en hoja inferior | Línea temporal + panel lateral de filtros; detalle en panel derecho | sin resultados con filtros |
| 8 | Crear/editar intervención | Pantalla completa, secciones: básico, costes, piezas | Diálogo grande o página con resumen de totales fijo a la derecha | aviso de km, salida con cambios sin guardar |
| 9 | Gastos y analítica | Selector de periodo arriba, total, donut, lista | Total + coste/km + donut + barras mensuales; tabla filtrable debajo | coste/km con datos insuficientes |
| 10 | Crear/editar gasto | Hoja inferior | Diálogo | litros solo en combustible |
| 11 | Perfil y ajustes | Lista de secciones | Dos columnas | cambio de contraseña, eliminar cuenta |
| 12 | Errores | 404, 403, error de red con reintento | | |

**Primer prototipo:** antes de programar, propongo maquetar en código (no en Figma) las pantallas 2, 4 y 8 con datos de ejemplo marcados como tal, para validar la dirección visual contigo y con 3‑5 usuarios. Si prefieres Figma, dímelo.

---

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| No tener la normativa real de Ilerna (la plantilla es de URJC) | Alto: estructura de memoria o tecnologías incorrectas | Conseguir la guía oficial (D1) antes de redactar la memoria; arquitectura reversible hasta E0. |
| Alcance excesivo frente al calendario | Alto | MVP cerrado en §5; todo lo demás en fases; revisar alcance cuando sepamos la fecha (D6). |
| Las referencias empujan a mostrar datos que no tenemos (salud, conducción) | Medio: credibilidad ante el tribunal y usuarios | Regla de producto: ninguna cifra sin fuente; alternativa por reglas en fase 2 (§4.1). |
| Diseño por delante de funcionalidad | Medio | Definición de terminado exige datos reales y estados; prototipo corto, luego funcionalidad. |
| Fallos de autorización (fuga de datos entre usuarios) | Alto | Policies + test de aislamiento por endpoint desde el primer día (E1‑5). |
| Configuración de Sanctum SPA (CORS, cookies, CSRF) | Medio | Mismo dominio de primer nivel en local y producción; prueba E2E de login temprano. |
| Código generado que no sepas defender | Alto en la defensa | Entregas pequeñas, explicación de cada decisión, ADR en `/docs`, tú revisas cada PR. |
| Imágenes de coches realistas | Medio | Siluetas SVG propias en MVP; nada de renders con marcas registradas ni logos de fabricantes sin licencia. |
| Costes de hosting e IA | Bajo ahora, alto en fase 3 | Hosting económico para la demo; IA solo tras validar con usuarios. |
| Competidores con funciones parecidas (Drivvo, Fuelio, Simply Auto…) | Medio comercial | Análisis de competencia en fase de descubrimiento antes de afirmar diferenciación. |
| Privacidad (RGPD) si hay usuarios reales | Alto comercial | Mínimos datos personales; exportar y borrar cuenta; política de privacidad antes de abrir a terceros. |

---

## 8. Estructura de la memoria (provisional)

⚠️ *Depende de Ilerna*: no sé qué apartados exige su guía. Propuesta a contrastar: introducción y objetivos · análisis del problema y competencia · requisitos funcionales y no funcionales · casos de uso e historias · diseño (arquitectura, E‑R, UML de clases y secuencia, diseño UI) · implementación · pruebas con resultados reales · despliegue · manual de instalación · manual de usuario · validación con usuarios · conclusiones y trabajo futuro · bibliografía · anexos (API, capturas).

La plantilla URJC aporta solo portada y estilos. **No la usaría** salvo que Ilerna no proporcione una propia y tú lo confirmes.

---

## 9. Siguiente paso si apruebas

1. Respondes D1‑D6 (como mínimo D2, D3 y D5).
2. Conectas el repositorio en ajustes del proyecto.
3. Hago la entrega E0‑1: monorepo con Laravel + React + MySQL arrancable, `README` y health check, con pruebas ejecutadas y resumen.
