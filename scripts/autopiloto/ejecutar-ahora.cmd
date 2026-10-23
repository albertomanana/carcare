@echo off
rem Lanza una ejecucion del piloto automatico ahora mismo (respeta la pausa y no duplica si ya hay una en marcha).
title CarCare - piloto automatico (ejecucion manual)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0autopiloto.ps1" -Once
pause
