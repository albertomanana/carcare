@echo off
rem Conecta este PC con tu cuenta de GitHub (una sola vez). Abre el navegador para que autorices.
title CarCare - conectar con GitHub
set "GH=%~dp0..\..\.tools\gh\bin\gh.exe"
if not exist "%GH%" (
  echo   [ERROR] No encuentro %GH%
  pause
  exit /b 1
)
"%GH%" auth status >nul 2>&1
if not errorlevel 1 (
  echo   Ya estas conectado a GitHub:
  "%GH%" auth status
  pause
  exit /b 0
)
echo.
echo   Se abrira el navegador. Pega el codigo que aparece abajo y pulsa "Authorize".
echo.
"%GH%" auth login --hostname github.com --git-protocol https --web --scopes workflow --skip-ssh-key
"%GH%" auth setup-git
echo.
"%GH%" auth status
echo.
echo   Listo. Claude (o el piloto automatico) creara el repositorio privado y subira el proyecto.
pause
