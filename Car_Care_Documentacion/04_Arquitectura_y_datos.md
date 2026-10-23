# Car Care — arquitectura y modelo de datos inicial

## 1. Regla principal

Antes de elegir o cambiar tecnologías, inspeccionar el repositorio existente y las instrucciones oficiales del TFG de Ilerna. Si el proyecto exige PHP y MySQL, respetar esa base. No reescribir el proyecto por preferencia personal ni borrar trabajo existente sin autorización.

## 2. Arquitectura candidata

- **Frontend:** React + TypeScript.
- **Estilos/componentes:** Tailwind CSS y componentes propios.
- **Gráficos:** Recharts o alternativa compatible.
- **Animaciones:** Framer Motion o alternativa compatible.
- **Backend candidato:** PHP/Laravel o API en PHP acorde a las restricciones académicas.
- **Base de datos:** MySQL.
- **Versionado:** Git/GitHub.
- **Pruebas:** PHPUnit para backend cuando corresponda; pruebas de API y de interfaz según el stack.
- **Despliegue:** entorno de desarrollo, staging/pruebas y producción separados.

La arquitectura definitiva depende del estado del repositorio, de los requisitos académicos y de la capacidad de mantenerla.

## 3. Separación de responsabilidades
- UI: presentación y estado de interacción.
- Servicios/API: operaciones y contratos claros.
- Backend: reglas de negocio, validación y autorización.
- Persistencia: esquema relacional, integridad y migraciones.
- Almacenamiento de archivos: privado y con controles de acceso.
- Integraciones: aisladas para poder reemplazarlas o desactivarlas.

## 4. Entidades candidatas

### users
- id
- name
- email (único)
- password_hash
- created_at
- updated_at

### vehicles
- id
- user_id (FK)
- make
- model
- generation (nullable)
- year (nullable)
- engine (nullable)
- fuel_type (nullable)
- transmission (nullable)
- registration_plate (nullable)
- vin (nullable)
- current_mileage (nullable)
- mileage_updated_at (nullable)
- archived_at (nullable)
- created_at
- updated_at

### maintenance_records
- id
- vehicle_id (FK)
- user_id (FK o verificable a través del vehículo)
- record_type
- title
- description (nullable)
- service_date
- mileage (nullable)
- workshop_name (nullable)
- labor_cost (nullable)
- parts_cost (nullable)
- total_cost
- created_at
- updated_at
- archived_at (nullable)

### expenses
- id
- vehicle_id (FK)
- user_id (FK o verificable a través del vehículo)
- category
- description
- amount
- expense_date
- mileage (nullable)
- created_at
- updated_at

### reminders
- id
- vehicle_id (FK)
- user_id (FK o verificable a través del vehículo)
- title
- description (nullable)
- due_date (nullable)
- due_mileage (nullable)
- status
- completed_at (nullable)
- created_at
- updated_at

### documents
- id
- vehicle_id (FK)
- maintenance_record_id (nullable FK)
- user_id (FK o verificable a través del vehículo)
- original_filename
- storage_key
- mime_type
- file_size
- document_type
- uploaded_at

### mileage_logs (opcional, recomendable si se necesita evolución de kilometraje)
- id
- vehicle_id (FK)
- user_id
- recorded_at
- mileage
- source
- created_at

### audit_events (según alcance)
- id
- user_id
- action
- entity_type
- entity_id
- created_at
- metadata limitada y sin secretos

El esquema debe revisarse antes de migrar o crear tablas. Añadir índices, restricciones, borrado/archivo coherente y reglas para evitar duplicados cuando proceda. No guardar campos redundantes sin justificar cómo se mantienen consistentes.

## 5. Reglas de integridad y cálculo
- Los importes deben usar un tipo decimal apropiado, no coma flotante binaria.
- El kilometraje no debe ser negativo; detectar saltos o retrocesos sospechosos.
- Las fechas y monedas deben manejarse de forma consistente.
- Evitar sumar dos veces una intervención y un gasto si representan el mismo desembolso. Definir si los gastos se registran por separado o se derivan de intervenciones.
- Coste por kilómetro requiere una definición clara del periodo y datos suficientes.
- Cualquier indicador de estado debe basarse en reglas explícitas y mostrar cuando falten datos.
- Registrar origen y nivel de confianza de datos importados o extraídos por IA cuando sea necesario.

## 6. Seguridad
- Verificar en backend la propiedad del recurso en cada petición.
- Nunca confiar únicamente en que el frontend oculte datos.
- Contraseñas con hashing seguro mediante mecanismos probados del framework.
- Proteger contra SQL injection, XSS, CSRF y accesos directos indebidos según arquitectura.
- Validar tamaño, MIME real y extensión de archivos; generar nombres internos seguros.
- No servir documentos privados mediante rutas públicas predecibles.
- Limitar tipos de archivo y aplicar límites de tamaño.
- Guardar secretos en variables de entorno y nunca en el repositorio.
- Limitar y proteger llamadas a servicios de IA.
- Definir retención, exportación y eliminación de datos personales antes del lanzamiento comercial.

## 7. API
Definir contratos claros para autenticación, vehículos, intervenciones, gastos, recordatorios y documentos. Documentar métodos, validaciones, respuestas, errores y autorización. Evitar que el frontend acceda directamente a la base de datos.

## 8. Pruebas mínimas
- Acceso autorizado y no autorizado a recursos.
- CRUD de vehículos e intervenciones.
- Cálculos de gastos y filtros.
- Validaciones de importes, fechas y kilometraje.
- Subida y descarga protegida de documentos.
- Estados vacíos, errores y responsive en flujos principales.
