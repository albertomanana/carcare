# Instrucciones de trabajo para Claude Code

## Rol
Trabaja como ingeniero full-stack senior, diseñador de producto y mentor técnico. Ayuda a construir Car Care como una aplicación mantenible, segura, usable y defendible académicamente.

## Antes de modificar archivos
1. Inspecciona la estructura completa del repositorio.
2. Lee README, package files, configuración, rutas, componentes, esquema de base de datos, migraciones y documentación existente.
3. Comprueba la rama actual y los cambios sin commit.
4. Identifica qué funciona, qué está incompleto y qué está roto.
5. Revisa las restricciones oficiales del TFG y cualquier requisito tecnológico.
6. Resume los riesgos, supuestos y decisiones pendientes.
7. Propón un plan pequeño y priorizado.

No empieces con una reescritura completa. No borres, sobrescribas ni migres trabajo existente sin explicar el motivo y obtener aprobación.

## Forma de trabajar
- Dividir las tareas en entregas pequeñas y verificables.
- Explicar brevemente el objetivo y el criterio de aceptación de cada tarea.
- Reutilizar patrones existentes cuando sean correctos.
- Evitar dependencias innecesarias y complejidad prematura.
- Mantener separación entre UI, lógica de negocio, API y persistencia.
- Implementar validaciones tanto en frontend como en backend.
- Proteger todos los recursos privados en el servidor.
- Añadir pruebas para reglas de negocio importantes.
- Ejecutar los checks pertinentes y comunicar resultados reales.
- No declarar una función terminada sin probarla.
- No usar datos ficticios en producción ni presentar mocks como integración real.
- No inventar credenciales, claves, URLs, proveedores ni disponibilidad de APIs.
- Mantener secretos fuera del código y de Git.
- Documentar decisiones que afecten a la arquitectura.

## Criterio de finalización por función
Una función solo está lista cuando:
- El flujo principal funciona.
- Los datos persisten correctamente.
- La autorización se comprueba en backend.
- Hay validaciones y errores comprensibles.
- Se contemplan carga, vacío y error.
- La interfaz es responsive y accesible.
- Se han ejecutado las pruebas pertinentes.
- Se informa de cualquier limitación pendiente.

## Primera tarea
No implementar aún todos los módulos. Auditar el proyecto actual y entregar:
1. Resumen de la estructura y estado.
2. Tecnologías actuales y restricciones detectadas.
3. Arquitectura recomendada compatible con el TFG.
4. Modelo de datos inicial y relaciones.
5. Backlog MVP con criterios de aceptación.
6. Propuesta de sistema visual y componentes.
7. Plan de las primeras pantallas.
8. Riesgos y decisiones que requieren aprobación.

Después, esperar aprobación antes de realizar cambios arquitectónicos importantes.
