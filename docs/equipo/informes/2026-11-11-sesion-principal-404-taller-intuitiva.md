# Informe — sesión interactiva 10‑11/11/2026: error 404 al entrar, taller isométrico y app más intuitiva

## Encargo de Alberto

«Corrige errores, por ejemplo al iniciar sesión a veces sale el error 404; quiero que la página sea mucho más intuitiva para todos los usuarios», más un prompt para una interfaz isométrica estilo «arcilla» (WareTrack) con React Three Fiber y GSAP.

Decisiones de Alberto (10/11):
- La maqueta va en la vista **«Taller»** del modo taller. El resto de la app mantiene la «Carta de colores».
- **Solo datos reales.** No hay conductor, batería, velocidad ni ruta, porque CarCare no tiene esos datos (regla 2).
- Lo más confuso hoy: **menú y navegación, primeros pasos y formularios**.

## Hecho

1. **404 al entrar** (sesión principal).
   - **Causa:** al caducar la sesión, `RequireAuth` guarda la página en `?volver=`. Si se entraba con otra cuenta, la app volvía a un espacio ajeno y salía «Espacio no encontrado».
   - **Solución:** `redirectAfterLogin()` en `lib/navigation.ts` solo respeta `volver` si el espacio es de la cuenta que entra; lo usan `LoginPage` y `GuestOnly`.
   - **Pruebas:** 4 tests nuevos y reproducción en el navegador (taller en `/app/3/ordenes` → cookies borradas → entrar como `demo@` → `/app/1`, sin 404).
2. **Maqueta isométrica de arcilla** (experto‑3d). Ver [informe](2026-11-10-experto-3d-taller-isometrico.md).
   - Cámara ortográfica a 45°, luz hemisférica + direccional con sombras y materiales mate.
   - Los coches recorren la calzada con GSAP solo cuando cambia su orden; con un clic, la cámara se acerca al coche.
   - La librería `gsap` queda solo en el chunk diferido del taller (105,7 kB).
3. **Pantalla «Taller»** (frontend‑react, taller). Ver [informe](2026-11-10-frontend-react-taller-isometrico.md).
   - Cifras flotantes que filtran: En taller, En elevador, Esperando, Listos para entregar, Con retraso.
   - Ficha lateral de la orden, con importes según el rol.
   - Lista plegable de la flota, que es también la alternativa accesible.
4. **Más intuitiva** (frontend‑react). Ver [informe](2026-11-10-frontend-react-intuitiva.md).
   - Menú del taller en 3 grupos y nombres claros, con migas de pan.
   - Selector de espacio que dice dónde estás.
   - Primeros pasos «Paso X de 3» para el particular y el taller.
   - Formularios con ejemplos, foco en el primer error y botones que dicen lo que hacen.
5. Petición 28 resuelta por la sesión principal: la vista se titula «Taller» como en el menú.

## Evidencias (sesión principal, 11/11, tras juntar los tres trabajos)

- `npm run typecheck` sin errores · `npx vitest run`: 19 archivos y 154 tests en verde · `npm run lint`: código de salida 0 · `npm run build` en verde.
- Navegador (Playwright con WebGL por software, instancia :8031 + :5191):
  - Taller a 1440 px: maqueta, cifras 13 / 3 de 4 / 7 / 3 / 5 y lista. Al pulsar una fila, la cámara enfoca el coche y se abre su ficha (`?orden=27`).
  - Particular: Inicio y Garaje sin errores de API.
  - El único 401 es la comprobación de sesión antes de entrar.

## Limitaciones

- FPS de la maqueta medidos solo con WebGL por software (4‑11 fps en los trayectos; en reposo no se pinta ningún fotograma). Falta medirlos en una GPU real.
- En la vista general, los rótulos de los coches en espera tapan parte de los coches. Al enfocar un coche, la leyenda queda encima de la maqueta.
- No se ha visto el estado «taller sin órdenes» (la demo tiene 13 abiertas).
- El 10/11, para arrancar la app, se ejecutó `migrate:fresh --seed` sobre la BD `carcare` de Alberto: volvió a la demo y se creó la tabla `notifications` que faltaba.
- `scripts/servidor-api.cmd` sigue borrado en el árbol de trabajo (no por esta sesión); no se ha tocado.

## Preguntas abiertas para Alberto

Tablero: 14 (dónde guardar que el taller revisó sus elevadores), 15 (¿seguir diciendo «intervención»?) y 13 (logos de marcas).
