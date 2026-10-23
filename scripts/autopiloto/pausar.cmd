@echo off
rem Pausa el piloto automatico de CarCare (la ejecucion en curso, si la hay, termina su tarea).
echo Pausado el %date% %time% > "%~dp0PAUSA"
echo.
echo   Piloto automatico de CarCare PAUSADO.
echo   Para reanudarlo: reanudar.cmd
echo.
timeout /t 4 >nul
