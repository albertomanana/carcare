@echo off
rem Quita el piloto automatico de CarCare del arranque de Windows.
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CarCare piloto automatico.lnk"
if exist "%LNK%" del "%LNK%"
echo.
echo   Quitado del arranque de Windows.
echo   Si la ventana "CarCare - piloto automatico" esta abierta, cierrala para detenerlo ahora.
echo.
pause
