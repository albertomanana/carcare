---
version: 1
slug: "frontend-src-components-layout-appshell-tsx"
primary_target: "frontend/src/components/layout/AppShell.tsx"
related_targets: ["frontend/src/features/dashboard/PersonalDashboard.tsx","frontend/src/features/garage/GaragePage.tsx","frontend/src/features/vehicle/VehicleDetailPage.tsx","frontend/src/index.css"]
---

## Scope

Núcleo particular de la app CarCare (modo Operate): estructura (barra lateral y cabecera), Inicio, Garaje y Ficha del vehículo. El resto de pantallas (taller incluido) hereda los tokens. Escritorio primero (portátil/PC de la defensa); móvil correcto a 360 px.

## Audience and job

Particular y taller por igual. Tarea: saber en segundos qué le toca a cada vehículo y por qué, y registrar km, gastos o intervenciones. Sin cifras inventadas; lo que falta se dice con su acción.

## Direction contract

THESIS: Cada vehículo es su muestra de pintura. El color real del coche (color_hex) identifica todo lo suyo sobre un gris neutro de cabina de igualación. Rechaza el panel oscuro con un acento neón y el SaaS blanco de tarjetas iguales.

OWN-WORLD: Fondo gris cabina N8 (#E4E4E1) y cartulina #F7F7F4; barra lateral grafito #232528; tinta #17191B; azul de calibración #1F4FD8 para la acción principal; rojo y ámbar solo como estado. El color de cada coche vive dentro de sus muestras lacadas (brillo de barniz, canto, sombra neutra). Archivo variable: anchura normal para el texto, estrecha y en versalitas para etiquetas y códigos. Cifras tabulares pegadas al margen derecho; cada bloque suma su total. Rejilla de 8 px.

STORY: El visitante reconoce sus coches por su color, ve lo vencido y lo próximo de cada uno y actúa (marcar hecho, anotar km, registrar gasto) sin buscar.

FIRST VIEWPORT: Barra lateral grafito de 256 px con la marca, la navegación y el abanico de muestras de tus vehículos. Área principal: cabecera con título, resumen y «Registrar» azul arriba a la derecha; a la izquierda, el escenario: placa de muestra con la pintura del coche elegido y su coche 3D, nombre, matrícula y km; a la derecha, «Pendiente» con estados; debajo, tres cifras del mes alineadas. Firma: el abanico 3D de muestras que se despliega y tiñe la pantalla con la pintura elegida.

FORM: Carta de colores de carrocería (candidata 7 de 7 por resonancia, asignada por el sorteo). seed:c220de75b8f9450d

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Raised lines

- De la carátula de casete: cada cifra del historial va pegada al margen derecho y cada bloque suma su total.
- Del léxico con láminas: el color vive dentro de las muestras; fuera solo grises neutros y estados.
- De la rejilla de Crouwel: la rejilla de 8 px se nota; muestras, cifras y paneles encajan en módulos enteros.
- Del horario aéreo: pocas tallas de letra; el rango lo dan el peso, las versalitas y las reglas.

## Unresolved

- Logotipos de marcas registradas (pregunta 4 del tablero).
- Tema oscuro: se conserva como «cabina apagada» (grafito), el claro es el predeterminado.
