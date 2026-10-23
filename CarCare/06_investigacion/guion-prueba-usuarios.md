# Guion de prueba con usuarios

*Preparado por el agente producto el 21/10/2026. Historia E6‑6. Todavía **no se ha hecho ninguna sesión**: este documento no contiene resultados. Los resultados se anotan solo cuando existan, con citas literales y sin redondear a favor.*

## 1. Objetivo

Comprobar con personas reales si CarCare se entiende y se puede usar **sin ayuda** en sus dos modos, y obtener datos para decisiones abiertas:

| Hipótesis o decisión | Qué queremos saber | Tareas o preguntas |
|----------------------|--------------------|--------------------|
| H‑P1 | ¿Se registra un repostaje en menos de 30 s desde el móvil? | P2 |
| H‑P2 / R20 | ¿El coche 3D con zonas ayuda a saber qué toca revisar, o se usa la lista? | P5 + preguntas de cierre |
| H‑P3 | ¿El informe sirve para vender el coche? | P7 + cierre |
| Regla de producto | ¿Se entiende "según tus intervalos, no medido"? ¿Alguien cree que es un diagnóstico? | P5 |
| ADR‑0003 | ¿El usuario intenta apuntar dos veces la misma reparación? | P3 |
| H‑T1 / R20 | ¿El tablero y los elevadores (2D o 3D) se entienden más rápido que su método actual? | T3, T6, T7 |
| H‑T2 / D13 | ¿El taller quiere que su trabajo llegue a la app del cliente? | T5 + cierre del taller |
| H‑T3 / D12 | ¿Lo usaría junto a su programa de facturación? | Cierre del taller |
| D10 / D11 | ¿Quién pagaría, por qué y cómo prefiere pagar? | Cierres |
| E13‑4 | ¿El mecánico entiende por qué no ve ciertas cosas? | T8 |

## 2. Participantes

**Particulares (3‑5).** Intentar cubrir perfiles distintos:
1. Coche de más de 8 años que va al taller varias veces al año.
2. Familia con 2 coches.
3. Alguien que **ya usa** una app (Drivvo, Fuelio…) o un Excel.
4. Alguien que **no lleva ningún control**.
5. (Si se puede) dueño de un híbrido o un eléctrico (unidades kWh).

**Talleres (2‑3).** Intentar:
1. Taller pequeño (1‑2 elevadores) donde el dueño también es mecánico.
2. Taller mediano (3‑6 elevadores) con encargado y mecánicos: probar también la cuenta de mecánico (T8).
3. (Opcional) responsable de una pequeña flota o de un taller de cadena.

Si no se consiguen talleres reales, se puede probar con perfiles cercanos (mecánicos en formación, por ejemplo), pero **se dirá así en la memoria**, sin presentarlos como talleres (R16).

## 3. Preparación (antes de cada sesión)

- [ ] Hacer una **sesión piloto** con alguien de confianza para ajustar tiempos y textos de las tareas.
- [ ] `php artisan migrate:fresh --seed` para partir siempre de los mismos datos demo.
- [ ] **Calcular las respuestas correctas** de P4, T4 y T7 con los datos demo **antes** de la sesión y apuntarlas en la hoja del moderador (no se inventan: se miran en la base de datos o con la API).
- [ ] Comprobar qué elevadores están libres en la demo (T2 y T6) y que el IVA del taller demo es el 21 % (si no, recalcular la respuesta de T4).
- [ ] Portátil con la app (1280 px) y un **móvil o la ventana a 360 px** para P2.
- [ ] Cronómetro, hoja de notas por tarea, consentimiento impreso o en pantalla.
- [ ] Cuentas: una **nueva** para P1‑P3, `demo@carcare.test` para P4‑P8, `taller@carcare.test` (owner) para T1‑T7 y `mecanico@carcare.test` para T8.

## 4. Desarrollo de la sesión

| Bloque | Particular | Taller |
|--------|-----------|--------|
| Bienvenida y consentimiento | 3 min | 3 min |
| Preguntas previas | 7 min | 10 min |
| Tareas (pensando en voz alta) | 25 min | 30 min |
| Cuestionario SUS | 3 min | 3 min |
| Preguntas de cierre | 7 min | 10 min |
| **Total aproximado** | **45 min** | **55‑60 min** |

**Texto de bienvenida (léelo tal cual):**
> "Gracias por ayudarme. Estoy probando la aplicación, no a ti: si algo no sale, es un fallo de la aplicación y es justo lo que necesito descubrir. Te pediré unas tareas; intenta hacerlas como lo harías en casa y **di en voz alta lo que piensas**. Yo no podré ayudarte salvo que te atasques del todo. No uses datos personales reales: inventa matrícula y nombres. ¿Te parece bien que tome notas (y que grabe la pantalla, si aceptas)? Puedes parar cuando quieras."

**Reglas del moderador:** no explicar la interfaz; si preguntan "¿dónde está…?", responder "¿dónde lo buscarías?". Ayudar solo tras 2 minutos atascados o si lo piden dos veces, y anotar "con ayuda".

## 5. Preguntas previas

**Particular** (de `_plantilla-entrevista.md`, preguntas 1‑6):
1. ¿Cómo llevas hoy el control del mantenimiento y los gastos del coche?
2. Cuéntame la última vez que fuiste al taller. ¿Qué guardaste de esa visita?
3. ¿Alguna vez se te ha pasado una ITV, revisión o seguro? ¿Qué pasó?
4. ¿Sabes cuánto te cuesta el coche al año?
5. ¿Has usado alguna app (Drivvo, Fuelio, miDGT…) o un Excel? ¿Por qué la sigues usando o la dejaste?
6. Si vendieras el coche, ¿cómo demostrarías su historial?

**Taller (bloque T‑Pre):**
1. ¿Cuántos elevadores y cuántas personas trabajáis? ¿Quién hace qué?
2. Cuando entra un coche, ¿cómo apuntáis el trabajo y su estado (pizarra, papel, programa)?
3. ¿Qué programa usáis para presupuestos y facturas? ¿Cuánto pagáis más o menos? ¿Qué es lo que menos os gusta de él?
4. ¿Cómo sabe el cliente cuándo está listo su coche?
5. ¿Guardáis el historial de cada coche? ¿Lo consultáis cuando vuelve?
6. ¿Qué es lo que más tiempo os hace perder en el día a día?

## 6. Tareas

*Lee cada tarea en voz alta y entrégala por escrito. El tiempo empieza cuando el participante termina de leer.*

### Particular

| # | Tarea (texto para el participante) | Éxito si… | Observar |
|---|------------------------------------|-----------|----------|
| P1 | "Acabas de descargar CarCare. Crea tu cuenta y añade tu coche con su color y los km que tiene ahora (inventa los datos)." | El vehículo aparece en el garaje con carrocería, color y km | ¿Rellena los pasos opcionales? ¿Le gusta la vista previa 3D o le distrae? Tiempo hasta ver el coche |
| P2 | *(en el móvil o a 360 px)* "Acabas de repostar: 40 €, 28 litros, depósito lleno, el cuentakilómetros marca 84.350. Apúntalo." | Gasto de combustible con litros, lleno y km | **Tiempo (H‑P1: objetivo < 30 s, a medir)**. ¿Encuentra el acceso rápido? ¿Entiende "depósito lleno"? |
| P3 | "Ayer te cambiaron el aceite en 'Taller Pepe' por 120 € a 84.300 km. Apúntalo. Después dime cuánto llevas gastado este mes." | Intervención con coste, y dice el total del mes correcto (sin contarla dos veces) | ¿Intenta añadirla **también** como gasto (doble registro)? ¿Entiende "desde intervención"? ¿Aparece el aviso de km si no cuadra con P2? |
| P4 | *(cuenta demo)* "¿Cuánto se ha gastado este coche en combustible en los últimos 3 meses?" | Cifra igual a la calculada antes de la sesión | ¿Usa filtros? ¿Confía en la cifra? |
| P5 | *(cuenta demo)* **"¿Hay algo que toque revisar pronto en este coche? ¿Qué y cuándo?"** | Identifica el recordatorio vencido o próximo y su fecha o km | **¿Usa el coche 3D, la lista o el dashboard?** ¿Toca las zonas? Al terminar: "¿Qué crees que significa 'según tus intervalos, no medido'?" (anotar literal: ¿cree que es un diagnóstico?) |
| P6 | "Supón que ya lo has hecho hoy. Márcalo como hecho. ¿Cuándo te tocará la próxima vez?" | Completa el recordatorio y localiza el siguiente | ¿Entiende que se creó el siguiente automáticamente? |
| P7 | "Vas a vender este coche. Prepara algo para enseñarle al comprador todo lo que le has hecho." | Llega al informe (y lo guarda o imprime, si está disponible) | ¿Lo encuentra? ¿Qué echa en falta? ¿Le da confianza el aviso "datos introducidos por el propietario"? |
| P8 *(opcional)* | "Busca la factura de la última reparación de este coche." | Abre el documento | ¿Busca en documentos o en la intervención? |

### Taller

| # | Tarea (texto para el participante) | Éxito si… | Observar |
|---|------------------------------------|-----------|----------|
| T1 | "Llega una clienta nueva, Laura, con un SUV gris (inventa la matrícula). Dala de alta con su coche." | Cliente creado y vehículo asociado a ella | ¿Empieza por el cliente o por el coche? Tiempo |
| T2 | "Abre una orden para ese coche: 'Ruido al frenar', 120.500 km, prometido para mañana; asígnasela a un mecánico y ponla en un elevador." | Orden creada en `Recibido` con mecánico y elevador | Si elige un elevador ocupado: ¿entiende el mensaje y cómo lo resuelve? |
| T3 | "El diagnóstico dice que faltan pastillas. Indícalo. Al día siguiente llegan las piezas: indícalo también." | La orden pasa a `Esperando piezas` y después a `En curso` | **¿Arrastra la tarjeta o usa "Mover a…"?** ¿Encuentra el tablero? |
| T4 | "Añade 2 pastillas delanteras a 45 € cada una y 1 hora de mano de obra a 50 €. ¿Cuánto pagará la clienta con IVA?" | Dice el total correcto (calculado antes: con IVA del 21 %, subtotal 140,00 €, IVA 29,40 €, total 169,40 €) | ¿Entiende el desglose? ¿Pregunta si es una factura? (D12) |
| T5 | "Ya está terminado y la clienta lo recoge. Entrégalo. ¿Dónde queda constancia del trabajo?" | Orden entregada y encuentra la intervención en el historial del coche | Reacción ante el historial automático (H‑T2) |
| T6 | **"¿Qué elevadores están libres ahora mismo y qué coche hay en el 3?"** | Respuesta correcta | **¿Usa el taller 3D o la lista?** Tiempo. ¿Le parece útil o un adorno? |
| T7 | "¿Qué órdenes van con retraso?" | Lista correcta (calculada antes) | ¿Desde el dashboard o desde el tablero? |
| T8 | *(cuenta de mecánico)* "Busca cuánto ha ingresado el taller este mes." | **No debe poder**: éxito si entiende que su rol no lo permite | ¿Se frustra? ¿Lo encuentra lógico? (E13‑4) |

## 7. Qué medir

| Métrica | Cómo | Dónde se anota |
|---------|------|----------------|
| Éxito por tarea | 1 = sin ayuda · 0,5 = con ayuda · 0 = no lo consigue o abandona | Tabla de resultados |
| Tiempo por tarea | Segundos desde que termina de leer hasta que dice "ya" | Tabla de resultados |
| Errores | Nº de acciones equivocadas (pantalla incorrecta, dato mal puesto) | Tabla de resultados |
| Facilidad percibida (SEQ) | Tras cada tarea: "En general, ¿esta tarea fue… 1 = muy difícil … 7 = muy fácil?" | Tabla de resultados |
| Uso del 3D | En P1, P5, T6: ¿usó la vista 3D (sí/no) y para qué? | Observaciones |
| Comprensión de los rótulos honestos | Respuesta literal sobre "según tus intervalos, no medido" y sobre "no es una factura" | Citas |
| Satisfacción global (SUS) | Cuestionario de 10 preguntas al final (sección 8) | Puntuación 0‑100 por participante |
| Citas literales | Frases textuales de dudas, quejas y elogios | `entrevista-NN.md` |

Con 3‑5 personas por segmento **los números son orientativos**: sirven para encontrar problemas, no para sacar estadísticas. En la memoria se presentarán así.

## 8. Cuestionario SUS (System Usability Scale)

Escala de Brooke (1996). Se responde de 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo). Traducción de trabajo, **no es una traducción validada**:

1. Creo que me gustaría usar esta aplicación con frecuencia.
2. La aplicación me ha parecido innecesariamente compleja.
3. Me ha parecido fácil de usar.
4. Creo que necesitaría ayuda de alguien técnico para poder usarla.
5. Las distintas funciones están bien integradas.
6. Me ha parecido que había demasiada incoherencia.
7. Imagino que la mayoría de la gente aprendería a usarla muy rápido.
8. Me ha resultado muy engorrosa de usar.
9. Me he sentido muy seguro/a usándola.
10. He necesitado aprender muchas cosas antes de poder manejarla.

Cálculo: en las impares, (respuesta − 1); en las pares, (5 − respuesta); se suman y se multiplica por 2,5 → 0‑100.

## 9. Preguntas de cierre

**Particular:**
1. ¿Qué es lo primero que harías con esto en tu día a día? ¿Qué te sobra?
2. El coche en 3D: ¿te ha ayudado a algo concreto o es sobre todo bonito? ¿Lo echarías de menos si no estuviera?
3. ¿Lo usarías en lugar de lo que usas hoy? ¿Por qué sí o por qué no?
4. ¿Pagarías por algo de esto? ¿Por qué parte? *(no sugerir precios)*. Si dice que sí: "¿A partir de qué precio al año te parecería caro? ¿Y tan barato que desconfiarías?"
5. Si tu taller usara CarCare, ¿te gustaría que lo que te hace apareciera solo en tu garaje? ¿Qué te preocuparía? (D13)

**Taller:**
1. ¿Usarías esto en tu taller? ¿Para qué sí y para qué no?
2. ¿Lo usarías **junto a** tu programa de facturación actual, o solo si lo sustituye? (D12, H‑T3)
3. El taller en 3D: ¿lo pondrías en una pantalla del taller? ¿Te ahorra algo frente a la lista?
4. ¿Te gustaría que el cliente viera el estado de su coche con un enlace? ¿Y que el trabajo entregado apareciera en su app? ¿Te preocupa algo (que se lleve el historial a otro taller…)? (D13)
5. ¿Cuántas personas lo usarían? ¿Cómo preferirías pagar: una cuota por taller, por persona o por elevador? ¿Cuánto pagas hoy? (D11) *(no sugerir precios)*

## 10. Umbrales de decisión (fijados ANTES de las pruebas)

*Se fijan ahora para no ajustarlos a los resultados. Con muestras pequeñas son señales, no pruebas.*

- Si una tarea del núcleo tiene **éxito sin ayuda en menos de la mitad** de los participantes, pasa a ser un problema prioritario de usabilidad antes de añadir funciones.
- Si en P5 y T6 **la mayoría no usa el 3D** o no lo entiende, el 3D se queda como presentación y la navegación principal será 2D (R20).
- Si **alguien interpreta el estado de zonas como un diagnóstico real**, se cambian los rótulos antes de la defensa.
- Si **2 de 3 talleres** dicen que no lo usarían sin facturación, se reabren D10 y D12 con esa evidencia.
- Si los talleres **rechazan** compartir el historial con el cliente, D13‑C se replantea antes de diseñarla.

## 11. Registro de resultados

Cada sesión se anota copiando `_plantilla-entrevista.md` como `entrevista-NN.md` (alias, sin datos personales). Después se resume aquí:

| Participante (alias) | Segmento | Tarea | Éxito (0/0,5/1) | Tiempo (s) | Errores | SEQ (1‑7) | ¿Usó 3D? | Nota |
|----------------------|----------|-------|-----------------|------------|---------|-----------|----------|------|
| | | | | | | | | |

| Participante | SUS (0‑100) | Hallazgo principal (cita literal) |
|--------------|-------------|------------------------------------|
| | | |

**Resumen** (solo cuando haya sesiones reales): problemas encontrados por gravedad, hipótesis confirmadas o descartadas, cambios propuestos al backlog y decisiones afectadas.

## 12. Consentimiento (texto breve)

> "Participo voluntariamente en una prueba de la aplicación CarCare, parte de un Trabajo de Fin de Grado de DAW. Se tomarán notas y, si lo acepto, se grabará solo la pantalla. Mis respuestas se guardarán con un alias, sin datos que me identifiquen, y solo se usarán para mejorar la aplicación y redactar la memoria. Puedo dejar la prueba en cualquier momento.
> Acepto grabación de pantalla: ☐ Sí ☐ No · Fecha: ____ · Firma o conformidad verbal anotada: ____"
