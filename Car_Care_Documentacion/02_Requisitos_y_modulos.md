# Car Care — requisitos y módulos

Este documento define un alcance inicial. No implica que todas las funciones deban implementarse en la primera versión.

## Prioridad 1 — MVP funcional

### Módulo A. Autenticación y perfil
- Registro, inicio y cierre de sesión.
- Perfil y configuración de cuenta.
- Validación de entradas y manejo coherente de errores.
- Autorización en el servidor para todas las operaciones privadas.

**Aceptación:** un usuario puede crear una cuenta, iniciar sesión, cerrar sesión y no puede acceder a recursos privados de otra cuenta modificando una URL o petición.

### Módulo B. Garaje digital
- Crear, editar y archivar vehículos.
- Marca, modelo, generación, año, motor, combustible y transmisión cuando se conozcan.
- Matrícula y VIN opcionales.
- Kilometraje actual y fecha de actualización.
- Varios vehículos por usuario.
- Vista individual de cada vehículo.

**Aceptación:** los datos persisten tras cerrar sesión; un usuario solo ve sus vehículos; los campos se validan y los datos opcionales no se inventan.

### Módulo C. Mantenimiento, reparaciones y averías
- Registrar intervenciones con fecha, kilometraje, tipo, descripción, taller, importe, piezas y mano de obra.
- Adjuntar notas, imágenes y facturas cuando el almacenamiento esté implementado.
- Historial cronológico por vehículo.
- Editar y archivar registros de forma controlada.

**Aceptación:** una intervención se puede crear, consultar, editar y archivar; queda asociada al vehículo correcto; los importes y fechas se validan; el historial se ordena correctamente.

### Módulo D. Gastos y analítica
- Categorías iniciales: combustible, mantenimiento, reparaciones, seguro, impuestos, aparcamiento y otros.
- Fecha, importe, descripción y vehículo asociado.
- Totales por mes, año, categoría y vehículo.
- Gráficos con filtros por periodo.
- Coste por kilómetro solo cuando exista información de kilometraje suficiente y coherente.

**Aceptación:** los totales coinciden con los registros de prueba; los filtros actualizan tanto las cifras como las gráficas; no se muestran cifras ficticias como si fueran reales.

### Módulo E. Dashboard
- Resumen del vehículo seleccionado.
- Próximos eventos y tareas pendientes.
- Últimas intervenciones.
- Resumen de gastos y acceso a analítica.
- Accesos rápidos a acciones frecuentes.
- Estados vacíos útiles cuando aún no hay datos.

**Aceptación:** todos los indicadores se obtienen de datos persistidos; cada acción visible funciona; el diseño es adaptable a móvil y escritorio.

## Prioridad 2 — completar el producto
- Recordatorios por fecha y kilometraje.
- ITV, seguro y otros vencimientos introducidos por el usuario.
- Notificaciones configurables.
- Archivo y previsualización de documentos.
- Búsqueda y filtros.
- Exportación de informe o historial del vehículo.
- Preferencias de usuario y mejor gestión de estados de carga/error.

**Aceptación general:** los recordatorios se calculan a partir de datos definidos por el usuario; los documentos están protegidos; los informes muestran claramente su origen y fecha de generación.

## Prioridad 3 — funciones inteligentes
- Extracción asistida de fecha, taller, kilometraje, concepto e importe de facturas.
- Pantalla de revisión y confirmación antes de guardar datos extraídos.
- Asistente que consulte los registros del usuario y cite o identifique los datos en los que se basa.
- Resúmenes de gastos y tareas próximas.
- Integraciones externas después de comprobar viabilidad, permisos y coste.

**Aceptación general:** el usuario puede revisar, corregir o descartar la extracción; la IA no guarda automáticamente datos dudosos; las respuestas distinguen hechos registrados de estimaciones y consejos.

## Requisitos no funcionales
- Seguridad y aislamiento de datos por usuario.
- Interfaz responsive y accesible.
- Rendimiento razonable y estados de carga claros.
- Código mantenible, modular y documentado.
- Validación tanto en frontend como en backend.
- Errores entendibles sin filtrar detalles sensibles.
- Copias de seguridad y estrategia de recuperación antes de producción.
- Pruebas automatizadas para reglas de negocio críticas.

## Fuera del MVP inicial
No intentar implementar de golpe marketplace, diagnósticos mecánicos automáticos, conexión OBD-II, consulta oficial de matrícula/VIN ni un portal completo para talleres. Evaluarlos solo después de tener una base funcional y validar la necesidad.
