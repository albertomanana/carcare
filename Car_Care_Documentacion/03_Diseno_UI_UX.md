# Car Care — dirección de diseño UI/UX

## 1. Objetivo visual

Crear una experiencia premium inspirada en productos de software automovilístico y SaaS modernos. Debe impresionar en la primera visita y seguir siendo cómoda en el uso cotidiano.

**Dirección inicial:** carbón/grafito, blanco cálido y verde lima eléctrico como acento. La paleta debe validarse en prototipo y comprobarse por contraste y accesibilidad. Considerar modo claro más adelante.

## 2. Principios
- Jerarquía visual evidente: el usuario debe entender rápidamente el estado del vehículo.
- Pocas acciones prioritarias por pantalla.
- Datos importantes fáciles de escanear.
- Componentes coherentes y reutilizables.
- Animaciones breves que comuniquen una acción o cambio de estado.
- Sin controles decorativos que no hagan nada.
- Formularios progresivos, con etiquetas claras y errores junto al campo correspondiente.
- Responsive real: escritorio, tablet y móvil.
- Accesibilidad: teclado, foco visible, contraste, etiquetas y movimiento reducido.

## 3. Sistema visual inicial

### Colores candidatos
- Fondo principal oscuro: `#111518`
- Superficie elevada: `#20272B`
- Borde sutil: `#333B40`
- Texto principal en modo oscuro: `#F5F7F7`
- Texto secundario: `#A5B0B5`
- Acento lima: `#C7F36B`

Son referencias iniciales, no tokens definitivos. Revisar contraste, estados hover/disabled/error/success y definir una escala completa de tokens antes de extenderlos por la aplicación.

### Tipografía
Elegir una familia sans-serif moderna, muy legible y disponible de forma fiable. Definir escalas para títulos, texto, etiquetas, cifras y datos tabulares. Las cifras financieras y de kilometraje deben alinearse y leerse con facilidad.

### Espaciado y formas
Definir una escala coherente de espaciado, radios, alturas de controles, sombras y anchuras de contenido. Evitar estilos diferentes para componentes equivalentes.

## 4. Pantallas prioritarias para el primer prototipo
1. Login y registro.
2. Dashboard principal.
3. Garaje/listado de vehículos.
4. Ficha del vehículo.
5. Historial de mantenimiento.
6. Crear/editar intervención.
7. Gastos y analítica.
8. Calendario o próximos eventos.
9. Documentos.
10. Perfil y configuración.

## 5. Dashboard
Debe incluir:
- Identidad y selector de vehículo.
- Imagen o representación visual del vehículo.
- Estado de mantenimiento basado en registros reales.
- Próximas tareas/vencimientos.
- Resumen de gastos del periodo seleccionado.
- Últimas intervenciones.
- Accesos rápidos.
- Estados vacíos con llamada a la acción clara.

No inventar un “health score” ni mostrar “todo al día” sin reglas y datos suficientes. Si el estado no puede determinarse, indicar que faltan datos.

## 6. Interacciones
- Hover/focus claros y consistentes.
- Confirmación al completar acciones relevantes.
- Diálogos accesibles para acciones destructivas.
- Skeletons o indicadores durante carga.
- Mensajes útiles para errores y estados vacíos.
- Filtros que actualicen tanto gráficos como cifras.
- Transiciones moderadas; no bloquear tareas con animaciones.
- Respeto por `prefers-reduced-motion`.

## 7. Componentes reutilizables
- Navegación lateral y móvil.
- Selector de vehículo.
- Tarjetas de resumen.
- Etiquetas de estado.
- Tablas/listados y filtros.
- Formularios y campos validados.
- Selector de fechas.
- Línea temporal.
- Gráficos.
- Diálogos y confirmaciones.
- Toasts/avisos.
- Carga, vacío, error y sin resultados.
- Subida de archivos y vista previa.

## 8. Criterio de calidad
Una pantalla no se considera terminada solo porque se vea bien. Debe tener datos reales, estados de carga/vacío/error, funcionamiento de controles, navegación con teclado, adaptación móvil y pruebas del flujo principal.
