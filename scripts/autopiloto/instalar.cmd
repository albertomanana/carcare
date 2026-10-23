@echo off
rem Instala el piloto automatico de CarCare en el arranque de Windows (solo para este usuario, sin permisos de administrador).
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CarCare piloto automatico.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK);" ^
  "$s.TargetPath = 'powershell.exe';" ^
  "$s.Arguments = '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0autopiloto.ps1\"';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'CarCare: arranca servidores, abre el proyecto y trabaja con Claude Code cada hora';" ^
  "$s.Save()"
if exist "%LNK%" (
  echo.
  echo   Instalado. Al iniciar sesion en Windows se abrira CarCare y el piloto automatico.
  echo   Acceso directo: %LNK%
  echo   Para quitarlo: desinstalar.cmd
) else (
  echo   [ERROR] No se pudo crear el acceso directo.
)
echo.
pause
