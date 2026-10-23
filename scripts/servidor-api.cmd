@echo off
rem API de CarCare en http://127.0.0.1:8000 (equivale a "php artisan serve", pero con OPcache).
rem XAMPP trae OPcache desactivado: sin el, cada peticion tarda unas 10 veces mas (medido el 23/10/2026).
rem Solo se activa para este servidor; no se toca el php.ini de XAMPP. validate_timestamps=1 y revalidate_freq=0
rem hacen que los cambios en el codigo se vean al instante.
title CarCare API (:8000)
cd /d "%~dp0..\backend\public"
php -d zend_extension=opcache -d opcache.enable_cli=1 -d opcache.validate_timestamps=1 -d opcache.revalidate_freq=0 -d opcache.memory_consumption=128 -S 127.0.0.1:8000 ..\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php
