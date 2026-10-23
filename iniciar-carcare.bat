@echo off
rem Arranca CarCare en local: MySQL (XAMPP) + API Laravel (:8000) + web Vite (:5173) y abre el navegador.
setlocal
title CarCare - arranque
cd /d "%~dp0"

echo.
echo   CarCare - arranque local
echo   ------------------------

rem 1. MySQL de XAMPP
netstat -an | findstr /r /c:":3306 .*LISTENING" >nul
if errorlevel 1 (
  if exist "C:\xampp\mysql_start.bat" (
    echo   MySQL no esta arrancado: iniciandolo desde XAMPP...
    start "MySQL (XAMPP)" /min /D "C:\xampp" cmd /c mysql_start.bat
    timeout /t 6 /nobreak >nul
  ) else (
    echo   [AVISO] No encuentro XAMPP. Arranca MySQL desde el panel de control de XAMPP.
  )
) else (
  echo   MySQL ya esta en marcha.
)

rem 2. Dependencias (solo la primera vez)
if not exist "backend\vendor" (
  echo   Instalando dependencias del backend...
  pushd backend
  php -d extension=zip -d extension=intl "..\.tools\composer.phar" install --no-interaction
  popd
)
if not exist "frontend\node_modules" (
  echo   Instalando dependencias del frontend...
  pushd frontend
  call npm install
  popd
)

rem 3. API Laravel
netstat -an | findstr /r /c:":8000 .*LISTENING" >nul
if errorlevel 1 (
  start "CarCare API (:8000)" /D "%~dp0backend" cmd /k php artisan serve --host=127.0.0.1 --port=8000
) else (
  echo   La API ya esta en marcha en el puerto 8000.
)

rem 4. Web (Vite)
netstat -an | findstr /r /c:":5173 .*LISTENING" >nul
if errorlevel 1 (
  start "CarCare Web (:5173)" /D "%~dp0frontend" cmd /k npm run dev
) else (
  echo   La web ya esta en marcha en el puerto 5173.
)

echo.
echo   Abriendo http://localhost:5173 ...
echo   Cuentas demo (contrasena "password"): demo@carcare.test  /  taller@carcare.test
echo   Si es la primera vez, en otra terminal: cd backend ^&^& php artisan migrate:fresh --seed
timeout /t 6 /nobreak >nul
start "" http://localhost:5173
endlocal
