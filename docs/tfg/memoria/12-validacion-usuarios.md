# 12. Validación con usuarios

> **Estado a 26/10/2026: solo el plan.** No se ha hecho **ninguna** sesión con usuarios ni ninguna entrevista. La carpeta `CarCare/06_investigacion/` contiene la plantilla de entrevista, el análisis de la competencia y el guion de pruebas, pero ningún archivo de resultados (`entrevista-NN.md`). Este capítulo describe el plan y deja preparadas las tablas de resultados **vacías**. Ninguna cifra de este capítulo es un resultado.

## 12.1 Objetivo

Comprobar con personas reales si CarCare se entiende y se puede usar **sin ayuda** en sus dos modos, y obtener evidencia para decisiones que siguen abiertas. El plan procede del guion `CarCare/06_investigacion/guion-prueba-usuarios.md`, preparado el 21/10/2026 por el agente `producto` (historia E6‑6), que fija las tareas, las métricas y los umbrales de decisión **antes** de las pruebas para no ajustarlos a los resultados.

Las hipótesis que se quieren contrastar son las del capítulo 2 (§2.2) y algunas decisiones del registro:

*Tabla 12.1. Preguntas que debe responder la validación.*

| Hipótesis o decisión | Pregunta | Tareas del guion |
|----------------------|----------|------------------|
| H‑P1 | ¿Se registra un repostaje en menos de 30 s desde el móvil? | P2 |
| H‑P2 / R20 | ¿El coche 3D con zonas ayuda a saber qué toca revisar, o se usa la lista? | P5 y cierre |
| H‑P3 | ¿El informe sirve para vender el coche? | P7 y cierre |
| Regla de veracidad (RNF-07) | ¿Se entiende "según tus intervalos, no medido"? ¿Alguien lo toma por un diagnóstico? | P5 |
| ADR‑0003 | ¿El usuario intenta apuntar dos veces la misma reparación? | P3 |
| H‑T1 / R20 | ¿El tablero y los elevadores (2D o 3D) se entienden más rápido que su método actual? | T3, T6 y T7 |
| H‑T2 / D13 | ¿El taller quiere que su trabajo llegue a la aplicación del cliente? | T5 y cierre |
| H‑T3 / D12 | ¿Lo usaría junto a su programa de facturación? | Cierre |
| E13‑4 | ¿El mecánico entiende por qué no ve ciertos datos? | T8 |

## 12.2 Participantes

*Tabla 12.2. Perfiles de participantes previstos.*

| Segmento | Número | Perfiles que se intentarán cubrir |
|----------|--------|-----------------------------------|
| Particulares | 3‑5 | Coche de más de 8 años con varias visitas al taller al año; familia con 2 coches; alguien que ya usa otra aplicación o una hoja de cálculo; alguien que no lleva ningún control; si es posible, dueño de un híbrido o eléctrico |
| Talleres | 2‑3 | Taller pequeño (1‑2 elevadores) cuyo dueño también es mecánico; taller mediano (3‑6 elevadores) con encargado y mecánicos; opcionalmente, responsable de una pequeña flota |

Reclutar talleres es el riesgo R16 del registro de riesgos (`CarCare/01_plan/riesgos.md`): probabilidad alta por falta de tiempo y de acceso. Si no se consiguen talleres reales, se probará con perfiles cercanos (por ejemplo, estudiantes de mecánica) y **se dirá así** en este capítulo, sin presentarlos como talleres.

> [PENDIENTE: reclutamiento — número real de participantes, perfil de cada uno (con alias) y fecha de cada sesión.]

## 12.3 Procedimiento

Cada sesión es individual, presencial o por videollamada, con el método de **pensar en voz alta**: el participante dice lo que piensa mientras hace las tareas y el moderador no le ayuda salvo que se bloquee.

*Tabla 12.3. Duración prevista de cada sesión.*

| Bloque | Particular | Taller |
|--------|-----------|--------|
| Bienvenida y consentimiento | 3 min | 3 min |
| Preguntas previas | 7 min | 10 min |
| Tareas | 25 min | 30 min |
| Cuestionario SUS | 3 min | 3 min |
| Preguntas de cierre | 7 min | 10 min |
| **Total aproximado** | **45 min** | **55‑60 min** |

**Preparación de cada sesión.** Partir siempre de los mismos datos de demostración; calcular en la base de datos, **antes** de la sesión, las respuestas correctas de las tareas con cifras (P4, T4 y T7); preparar la aplicación a 1280 px y un móvil o una ventana de 360 px para P2; y usar una cuenta nueva para P1‑P3, `demo@carcare.test` para P4‑P8, `taller@carcare.test` para T1‑T7 y `mecanico@carcare.test` para T8. Antes de la primera sesión se hará una **sesión piloto** con una persona de confianza para ajustar tiempos y textos; sus datos no se cuentan.

**Tareas.** El guion define ocho tareas del particular (P1‑P8: crear la cuenta y el coche, apuntar un repostaje en el móvil, apuntar una reparación con coste y decir el gasto del mes, consultar el gasto en combustible, identificar qué toca revisar, completar un recordatorio, preparar el informe para vender el coche y, opcionalmente, encontrar una factura) y ocho del taller (T1‑T8: alta de cliente y coche, abrir una orden con mecánico y elevador, cambiar su estado, añadir líneas y calcular el total con IVA, entregarla, ver qué elevadores están libres, ver qué órdenes van con retraso y, con la cuenta de mecánico, intentar ver los ingresos del taller). El texto exacto de cada tarea y su criterio de éxito están en el §6 del guion.

> [PENDIENTE: tarea 16 — revisar el texto de las tareas cuando termine la simplificación de la interfaz, porque algunas mencionan acciones concretas de la pantalla ("Mover", tablero). Si se construye E16 (solicitudes a talleres, tareas 32‑35), valorar una tarea más en cada modo.]

## 12.4 Qué se mide

*Tabla 12.4. Métricas de la validación.*

| Métrica | Cómo se obtiene |
|---------|-----------------|
| Éxito por tarea | 1 = sin ayuda; 0,5 = con ayuda; 0 = no lo consigue o abandona |
| Tiempo por tarea | Segundos desde que termina de leer la tarea hasta que dice que ha acabado |
| Errores | Número de acciones equivocadas (pantalla incorrecta, dato mal puesto) |
| Facilidad percibida (SEQ) | Tras cada tarea, de 1 (muy difícil) a 7 (muy fácil) (Sauro y Dumas, 2009) |
| Uso del 3D | En P1, P5 y T6: si usó la vista 3D y para qué |
| Comprensión de los rótulos | Respuesta literal sobre "según tus intervalos, no medido" y sobre "no es una factura" |
| Satisfacción global (SUS) | Cuestionario de 10 preguntas al final, puntuación de 0 a 100 (Brooke, 1996). Se usa una traducción de trabajo, no validada |
| Citas literales | Frases textuales de dudas, quejas y elogios |

Con 3‑5 particulares y 2‑3 talleres, los resultados son **señales cualitativas**, no conclusiones estadísticas. Se informará de cada participante por separado y no se calcularán medias de SUS por segmento si hay menos de tres participantes en él.

## 12.5 Umbrales de decisión

Fijados en el guion antes de las pruebas:

1. Si una tarea del núcleo tiene **éxito sin ayuda en menos de la mitad** de los participantes, pasa a ser un problema prioritario de usabilidad antes de añadir funciones.
2. Si en P5 y T6 **la mayoría no usa el 3D** o no lo entiende, el 3D se queda como presentación y la navegación principal será 2D (riesgo R20).
3. Si **alguien interpreta el estado de las zonas como un diagnóstico real**, se cambian los rótulos antes de la defensa.
4. Si **2 de 3 talleres** dicen que no lo usarían sin facturación, se reabren las decisiones D10 y D12 con esa evidencia.
5. Si los talleres **rechazan** compartir el historial con el cliente, se replantea D13‑C antes de diseñarla.

## 12.6 Ética y protección de datos

- **Consentimiento** informado antes de empezar, con el texto breve del §12 del guion: participación voluntaria, notas con alias, grabación solo de la pantalla y solo si se acepta, uso limitado a mejorar la aplicación y redactar esta memoria, y posibilidad de abandonar en cualquier momento.
- **Datos ficticios.** Los participantes inventan los datos que introducen; nunca se usan su matrícula, su NIF ni datos reales de clientes de un taller.
- **Seudonimización.** Cada participante se identifica con un alias. Las notas no incluyen nombre, teléfono ni correo.
- **Conservación.** Las grabaciones, si las hay, se guardan fuera del repositorio y se borran al entregar el TFG.

> ⚠️ Depende de Ilerna: si el centro exige un modelo propio de consentimiento o una autorización para trabajar con participantes, sustituirá al texto del guion.

## 12.7 Resultados

> [PENDIENTE: validación con usuarios — no se ha hecho ninguna sesión. Las tablas siguientes se rellenan solo con datos reales, copiados de los archivos `CarCare/06_investigacion/entrevista-NN.md`.]

*Tabla 12.5. Resultados por tarea (vacía hasta que haya sesiones).*

| Participante (alias) | Segmento | Tarea | Éxito (0 / 0,5 / 1) | Tiempo (s) | Errores | SEQ (1‑7) | ¿Usó el 3D? | Nota |
|----------------------|----------|-------|---------------------|------------|---------|-----------|-------------|------|
| PENDIENTE | | | | | | | | |

*Tabla 12.6. SUS y hallazgo principal por participante (vacía hasta que haya sesiones).*

| Participante (alias) | SUS (0‑100) | Hallazgo principal (cita literal) |
|----------------------|-------------|-----------------------------------|
| PENDIENTE | | |

*Tabla 12.7. Aplicación de los umbrales de decisión (vacía hasta que haya sesiones).*

| Umbral (§12.5) | ¿Se cumple? | Evidencia | Acción |
|----------------|-------------|-----------|--------|
| 1. Éxito sin ayuda en tareas del núcleo | PENDIENTE | | |
| 2. Uso del 3D | PENDIENTE | | |
| 3. Rótulo "según tus intervalos, no medido" | PENDIENTE | | |
| 4. Uso sin facturación | PENDIENTE | | |
| 5. Compartir historial con el cliente | PENDIENTE | | |

## 12.8 Limitaciones previstas

- **Muestra pequeña y de conveniencia**, reclutada en el entorno del autor. Puede haber sesgo de cortesía: los conocidos tienden a valorar mejor.
- **Moderador y autor son la misma persona**, lo que puede influir en cómo se presentan las tareas. El guion escrito y las tareas leídas literalmente lo reducen.
- **Datos de demostración**: el participante trabaja con un coche y un taller que no son suyos, lo que hace más difícil juzgar la utilidad real que la usabilidad.
- **Fecha.** El plan del equipo hasta el 31/10/2026 (capítulo 3, §3.4) no reserva días para las sesiones. Si no da tiempo antes de la entrega, este capítulo quedará como plan y las conclusiones (capítulo 13) lo dirán así.

> [PENDIENTE: decisión de Alberto — fecha de las sesiones y si se hacen antes o después de la entrega. ⚠️ Depende de Ilerna (fecha de entrega).]
