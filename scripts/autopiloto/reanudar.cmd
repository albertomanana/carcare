@echo off
rem Reanuda el piloto automatico de CarCare: la siguiente comprobacion horaria volvera a trabajar.
if exist "%~dp0PAUSA" del "%~dp0PAUSA"
echo.
echo   Piloto automatico de CarCare REANUDADO.
echo   Trabajara en la proxima comprobacion (como mucho, en una hora).
echo   Para lanzarlo ya: ejecutar-ahora.cmd
echo.
timeout /t 4 >nul
