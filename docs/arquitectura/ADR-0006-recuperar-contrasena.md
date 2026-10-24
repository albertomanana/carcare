# ADR‑0006 · Recuperar la contraseña con el broker de Laravel y el correo en el log

| Campo | Valor |
|-------|-------|
| Estado | Aceptada (24/10/2026) |
| Decide | Alberto decidió el alcance y el envío de correos (D17 = A, 24/10/2026). El diseño técnico es del arquitecto |
| Contrato | [§3.1.1](../api/contrato-v1.md#311-recuperar-la-contraseña) |

## Contexto

La pantalla de entrar no tiene "¿Has olvidado tu contraseña?" (E1‑6, Should). Alberto lo quiere, con el **correo solo en local**: no hay servicio de correo ni presupuesto.

Una recuperación de contraseña mal hecha tiene tres riesgos:
- **revela qué emails tienen cuenta** (enumeración);
- **permite probar tokens** por fuerza bruta;
- **deja sesiones vivas** de quien pudiera tener la contraseña antigua.

Restricciones:
- API JSON con Sanctum en modo SPA, que exige CSRF;
- PHP 8.2 y Laravel 12;
- ninguna dependencia nueva sin justificar (regla 8);
- sin colas ni servicios extra (ADR‑0001: simplicidad defendible).

## Opciones

### A) El broker de contraseñas de Laravel, dos endpoints JSON propios y `MAIL_MAILER=log`
- A favor:
  - viene con Laravel y la tabla `password_reset_tokens` ya existe;
  - guarda el token hasheado, con caducidad, de un solo uso y con límite de envíos por cuenta;
  - el mailer `log` escribe el correo en `storage/logs` sin coste;
  - pasar a SMTP es solo configuración.
- En contra:
  - hay que adaptar el enlace del correo para que apunte a la SPA (`ResetPassword::createUrlUsing`);
  - hay que escribir el texto del correo en español.

### B) Tokens propios (tabla y lógica escritas a mano)
- A favor: control total.
- En contra: reinventa lo que el broker ya resuelve, con más riesgo de errores de seguridad y más tests.

### C) Código numérico de un solo uso (OTP de 6 dígitos) por correo
- A favor: no hace falta un enlace.
- En contra:
  - un espacio de 10⁶ códigos obliga a limitar los intentos con mucho más cuidado;
  - necesita su propia tabla y su propia lógica.

### D) Laravel Fortify
- A favor: trae el flujo hecho.
- En contra: es una dependencia nueva que añade rutas y opciones que no se usan (2FA, verificación) y otra capa que explicar en la defensa.

## Decisión

**A**, con estas reglas (detalle en el contrato §3.1.1):
- `POST /auth/forgot-password` responde **204 siempre**, exista o no la cuenta y aunque el broker no haya enviado el correo.
- El token es **de un solo uso** y **caduca a los 60 minutos**. Pedir otro enlace invalida el anterior.
- Las dos rutas tienen un límite de **5 peticiones por minuto y por IP** (429).
- Un token incorrecto, caducado o usado, o un email sin cuenta, dan **el mismo** 422 en `errors.token`.
- Al restablecer:
  - **se cierran todas las sesiones de la cuenta** (se borran sus filas de `sessions`);
  - se rota `remember_token`;
  - **no se inicia sesión**.
- Las dos rutas son públicas, pero exigen CSRF como el login.
- El enlace del correo lleva a la SPA: `/restablecer?token=…&email=…`.

## Consecuencias

**En el código:**
- Clave `app.frontend_url` en `config/app.php`, con valor por defecto `http://localhost:5173`. No se lee ni se edita `.env`.
- Una notificación en español.
- Dos FormRequest y dos rutas con `throttle:5,1`.
- En la SPA: dos pantallas (`/recuperar`, `/restablecer`) y el enlace en `LoginPage`.

**Qué queda más difícil después:**
- **El tiempo de respuesta puede delatar la cuenta.** Si existe, el broker hashea el token con bcrypt, y eso tarda más. Se recomienda un hash de relleno cuando no existe.
- **Con un servicio de correo real** habría que encolar el envío, para que la espera del servidor de correo no delate la cuenta. Hoy, con el log, no hace falta: no se añaden colas sin una necesidad demostrada.
- **El correo del log** puede salir con codificación *quoted‑printable*, que parte el enlace en varias líneas. El backend comprueba que se pueda copiar. Si no se puede, se escribe además una línea de log con el enlace en claro, solo cuando el mailer es `log`.

**Fuera de alcance:** verificación del email al registrarse y 2FA (trabajo futuro).

## Cómo defenderlo

1. **No reinvento la criptografía.** Uso el mecanismo estándar de Laravel: token aleatorio guardado hasheado, que caduca a los 60 minutos y solo vale una vez.
2. **No se puede saber si un email tiene cuenta.** La respuesta, los mensajes de error y el límite de intentos son iguales exista o no.
3. **Cambiar la contraseña echa a cualquiera que tuviera la antigua**: se cierran todas las sesiones y se invalidan las cookies "Recordarme".
4. **El correo va al log por decisión del proyecto (D17)**, sin coste ni servicios externos. Para producción solo cambia la configuración del mailer.
