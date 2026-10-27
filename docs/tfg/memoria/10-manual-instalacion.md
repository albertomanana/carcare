# 10. Manual de instalación

Este manual explica cómo instalar y arrancar CarCare en un equipo **Windows con XAMPP**, que es el entorno en el que se ha desarrollado. Se basa en `README.md`, en `iniciar-carcare.bat`, en `scripts/servidor-api.cmd` y en las instrucciones del proyecto (`CLAUDE.md`).

> [PENDIENTE: tarea 11 — el procedimiento completo no se ha probado todavía en un equipo limpio. El agente `devops` debe hacerlo y corregir este capítulo y el `README.md` con lo que encuentre. En particular, ni el `README.md` ni `iniciar-carcare.bat` crean el archivo `.env` del backend: el paso 3 de este manual lo añade siguiendo el procedimiento estándar de Laravel.]

## 10.1 Requisitos

*Tabla 10.1. Requisitos de software.*

| Componente | Versión | Notas |
|------------|---------|-------|
| Sistema operativo | Windows 10 u 11 | Desarrollado en Windows 11 Pro. Los scripts `.bat` y `.cmd` son de Windows; en otros sistemas se usan los comandos del apartado 10.5 |
| XAMPP | Con PHP 8.2 y MariaDB 10.4 | Desarrollado con PHP 8.2.12 y MariaDB 10.4.32. Laravel 12 exige PHP 8.2 o superior |
| Node.js | 20 o superior según el `README.md` | Desarrollado con Node 25.6.1 |
| Git | Cualquier versión reciente | Para obtener el código |
| Navegador | Chrome, Edge, Firefox o Safari recientes | Con WebGL se ve el 3D; sin él, la aplicación muestra la alternativa 2D |

**Extensiones de PHP.** La aplicación no usa la extensión `intl` en tiempo de ejecución (el formato de números y fechas se hace en el navegador). `iniciar-carcare.bat` activa `zip` e `intl` solo para la instalación de dependencias con Composer. Para detectar el tipo real de los documentos subidos se usa `fileinfo` (`UploadedFile::getMimeType()`).

**Composer** no tiene que estar instalado: el repositorio incluye `.tools/composer.phar` y un envoltorio, `.tools/composer`.

## 10.2 Obtener el código

El repositorio es privado en GitHub (`albertomanana/carcare`); hace falta que el autor conceda acceso. La rama de trabajo es `develop`; `main` solo recibe versiones cerradas.

```bash
git clone https://github.com/albertomanana/carcare.git
cd carcare
git checkout develop
```

## 10.3 Instalación paso a paso

**1. Arrancar MySQL (MariaDB) desde XAMPP.** Desde el panel de control de XAMPP, o con `C:\xampp\mysql_start.bat`. Debe escuchar en el puerto 3306.

**2. Crear la base de datos.** Con el usuario `root` sin contraseña de XAMPP:

```bash
C:/xampp/mysql/bin/mysql -u root -e "CREATE DATABASE carcare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

El juego de caracteres coincide con los valores por defecto de `backend/config/database.php`.

**3. Configurar el backend.** Desde la carpeta `backend/`:

```bash
../.tools/composer install
cp .env.example .env
php artisan key:generate
```

En el `.env` hay que indicar la conexión a MariaDB, porque sin ella Laravel usa SQLite (`config/database.php`, valor por defecto `sqlite`):

```ini
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=carcare
DB_USERNAME=root
DB_PASSWORD=
```

> El `.env` contiene secretos (la clave de la aplicación) y está excluido del control de versiones. No se debe subir ni compartir.

**4. Crear las tablas y los datos de demostración:**

```bash
php artisan migrate --seed
```

`migrate:fresh --seed`, que aparece en el `README.md`, hace lo mismo pero **borra antes todas las tablas**: úsese solo en una instalación nueva o para empezar de cero. Los datos de demostración se pueden poner al día en cualquier momento sin borrar nada con `php artisan db:seed`, porque el *seeder* es aditivo e idempotente (capítulo 7, §7.7). En un entorno de producción (`APP_ENV=production`) no se carga ningún dato de demostración.

**5. Instalar el frontend.** Desde la carpeta `frontend/`:

```bash
npm install
```

## 10.4 Arrancar la aplicación

**Con un clic.** Doble clic en `iniciar-carcare.bat`, en la raíz del repositorio. El script:

1. comprueba si MySQL escucha en el puerto 3306 y, si no, lo arranca desde XAMPP y espera hasta 2 minutos a que acepte conexiones;
2. instala las dependencias del backend y del frontend si faltan las carpetas `vendor` o `node_modules`;
3. abre la API en una ventana (`scripts/servidor-api.cmd`, puerto 8000) y la web en otra (`npm run dev`, puerto 5173), salvo que ya estén en marcha;
4. abre el navegador en http://localhost:5173.

**A mano**, en dos terminales:

```bash
# API en http://127.0.0.1:8000 con OPcache, desde la raíz del repositorio.
# En cmd de Windows:  scripts\servidor-api.cmd
# En Git Bash:
cmd.exe //c scripts\\servidor-api.cmd

# Web en http://localhost:5173 (desde frontend/)
npm run dev
```

Se recomienda `scripts/servidor-api.cmd` en lugar de `php artisan serve`: activa OPcache solo para ese proceso, sin tocar el `php.ini` de XAMPP, y sin él cada petición tarda unas diez veces más (medido el 23/10/2026).

**Comprobar que funciona:**

*Tabla 10.2. Comprobaciones tras el arranque.*

| Comprobación | Resultado esperado |
|--------------|--------------------|
| http://127.0.0.1:8000/api/v1/health | `{"status":"ok"}` |
| http://localhost:5173 | Portada de CarCare |
| Entrar con una cuenta de demostración | Su espacio con datos |

## 10.5 Cuentas de demostración

Todas con la contraseña `password` (`backend/database/seeders/DemoSeeder.php`). Los datos son ficticios.

*Tabla 10.3. Cuentas de demostración.*

| Cuenta | Perfil | Qué tiene |
|--------|--------|-----------|
| `demo@carcare.test` | Particular | 2 vehículos con unos 18 meses de historial |
| `taller@carcare.test` | Propietario de "Taller Demo" | 4 elevadores, 12 clientes, 20 vehículos y unas 36 órdenes |
| `gerente@carcare.test` | Gerente del taller | Gestiona, pero no puede eliminar el taller |
| `mecanico@carcare.test` | Mecánico del taller | Opera; no ve importes ni gastos |

El `README.md` y `iniciar-carcare.bat` solo mencionan las dos primeras. [PENDIENTE: tarea 11 — añadir las otras dos al `README.md`.]

## 10.6 Ejecutar las pruebas

```bash
# Backend (desde backend/): SQLite en memoria, no toca la base carcare
php artisan test
php artisan test --parallel   # igual, repartido en varios procesos (511 pruebas el 26/10/2026)

# Frontend (desde frontend/)
npm run typecheck
npm run lint
npm run test
npm run build      # comprueba tipos y genera dist/
```

Para ejecutar la batería del backend sobre MariaDB, sin tocar la base `carcare`, se usa una base separada (por ejemplo `carcare_test`) indicándola en el comando, como hizo el agente de backend el 23/10 (capítulo 8):

```bash
DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 DB_DATABASE=carcare_test DB_USERNAME=root DB_PASSWORD= php artisan test
```

No conviene lanzar dos baterías independientes a la vez en la misma carpeta (por ejemplo, SQLite y MariaDB): comparten el disco falso de ficheros y se interfieren. La opción `--parallel` de una sola batería sí funciona (capítulo 8, §8.8).

## 10.7 Problemas frecuentes

*Tabla 10.4. Problemas frecuentes.*

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| La API no arranca o responde con error de conexión | MySQL no está en marcha | Arrancarlo desde XAMPP; `iniciar-carcare.bat` espera a que acepte conexiones antes de abrir la API |
| "La sesión ha caducado. Recarga la página" (419) | La cookie CSRF ha caducado o se ha mezclado `localhost` con `127.0.0.1`, que el navegador trata como sitios distintos | Abrir siempre la web por http://localhost:5173 y recargar la página. El cliente ya renueva el token y reintenta una vez por su cuenta |
| Se entra pero cada acción devuelve 401 | La web se sirve en un puerto distinto de los que Sanctum considera de confianza | Arrancar la API con `SANCTUM_STATEFUL_DOMAINS` incluyendo ese puerto (ver "Instancia aislada" en `CLAUDE.md`) |
| La API va muy lenta | Arrancada con `php artisan serve`, sin OPcache | Usar `scripts/servidor-api.cmd` |
| Puerto 8000 o 5173 ocupado | Ya hay una instancia en marcha | `iniciar-carcare.bat` lo detecta y no abre otra; si es otro programa, cerrarlo |
| La ficha del vehículo muestra una silueta en lugar del 3D | El navegador no tiene WebGL, o la URL lleva `?sin3d` | Es el comportamiento previsto: la información está en la lista de zonas |
| `composer` no se reconoce | No está en el `PATH` | Usar `../.tools/composer` desde `backend/` |
