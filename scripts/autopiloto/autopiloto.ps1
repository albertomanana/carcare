<#
  Piloto automatico de CarCare.

  Sin parametros (lo lanza el acceso directo de Inicio de Windows):
    1. Arranca MySQL (XAMPP), la API Laravel (:8000) y la web Vite (:5173) si no estan en marcha.
    2. Abre el proyecto en VS Code.
    3. Cada hora (o justo cuando se resetea el limite de uso, si Claude dijo la hora) lanza una
       sesion no interactiva de Claude Code que trabaja segun docs/equipo/AUTOPILOTO.md.

  -Once : una sola ejecucion (ejecutar-ahora.cmd).

  Control: crear el archivo PAUSA en esta carpeta lo pausa (pausar.cmd / reanudar.cmd).
  Registro: scripts/autopiloto/logs/
#>
param(
  [switch]$Once,
  [int]$IntervalMinutes = 60,
  [int]$StartupDelaySeconds = 90
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Dir   = $PSScriptRoot
$Root  = (Resolve-Path (Join-Path $Dir '..\..')).Path
$Logs  = Join-Path $Dir 'logs'
$Pause = Join-Path $Dir 'PAUSA'
$Lock  = Join-Path $Dir 'autopiloto.lock'
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$Host.UI.RawUI.WindowTitle = 'CarCare - piloto automatico (cierra esta ventana para detenerlo)'

function Write-Log([string]$Message) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Write-Host $line
  Add-Content -Path (Join-Path $Logs 'autopiloto.log') -Value $line -Encoding UTF8
}

function Test-Port([int]$Port) {
  [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Start-DevServices {
  if (-not (Test-Port 3306)) {
    if (Test-Path 'C:\xampp\mysql\bin\mysqld.exe') {
      Start-Process -FilePath 'C:\xampp\mysql\bin\mysqld.exe' -ArgumentList '--defaults-file=C:\xampp\mysql\bin\my.ini', '--standalone' -WindowStyle Hidden
      Write-Log 'MySQL (XAMPP) arrancado.'
    } else {
      Write-Log 'AVISO: no se encuentra XAMPP; MySQL no arrancado.'
    }
  }
  if (-not (Test-Port 8000)) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'title CarCare API (:8000) && php artisan serve --host=127.0.0.1 --port=8000' -WorkingDirectory (Join-Path $Root 'backend') -WindowStyle Minimized
    Write-Log 'API Laravel arrancada en :8000.'
  }
  if (-not (Test-Port 5173)) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'title CarCare Web (:5173) && npm run dev' -WorkingDirectory (Join-Path $Root 'frontend') -WindowStyle Minimized
    Write-Log 'Web Vite arrancada en :5173.'
  }
}

function Open-Project {
  $code = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe'
  if (Test-Path $code) {
    Start-Process -FilePath $code -ArgumentList ('"{0}"' -f $Root)
    Write-Log 'Proyecto abierto en VS Code.'
  }
}

# Devuelve la fecha del proximo reseteo si Claude la indico ("resets 5:20pm"), o $null.
function Get-ResetTime([string]$Text) {
  $m = [regex]::Match($Text, '(?i)resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)')
  if (-not $m.Success) { return $null }
  $hour = [int]$m.Groups[1].Value % 12
  if ($m.Groups[3].Value -ieq 'pm') { $hour += 12 }
  $minute = if ($m.Groups[2].Success) { [int]$m.Groups[2].Value } else { 0 }
  $reset = (Get-Date).Date.AddHours($hour).AddMinutes($minute)
  if ($reset -le (Get-Date)) { $reset = $reset.AddDays(1) }
  return $reset
}

# Una ejecucion. Devuelve la fecha de reseteo si se alcanzo el limite de uso; si no, $null.
function Invoke-AutopilotRun {
  if (Test-Path $Pause) { Write-Log 'En pausa (existe PAUSA): no se ejecuta.'; return $null }

  if (Test-Path $Lock) {
    $otherPid = Get-Content $Lock -ErrorAction SilentlyContinue
    if ($otherPid -and (Get-Process -Id $otherPid -ErrorAction SilentlyContinue)) {
      Write-Log "Ya hay una ejecucion en marcha (PID $otherPid): se omite."
      return $null
    }
  }
  Set-Content -Path $Lock -Value $PID

  try {
    Start-DevServices
    $stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
    $runLog = Join-Path $Logs "ejecucion-$stamp.log"
    Write-Log "Ejecucion iniciada. Registro: $runLog"

    Push-Location $Root
    # Sin -p hay 10 min de tope esperando a subagentes en segundo plano: lo quitamos (0 = sin tope).
    $env:CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS = '0'
    # Si se agota el limite de uso a mitad, la sesion espera al reseteo y continua (comprueba cada 10 min).
    $env:CLAUDE_CODE_RETRY_WATCHDOG = '1'
    $env:CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS = '600000'
    # Instruccion corta en ASCII: el encargo completo esta en prompt.md (evita problemas de comillas y acentos).
    $instruction = 'Lee el archivo scripts/autopiloto/prompt.md y sigue sus instrucciones al pie de la letra.'
    # Modo auto: aprueba lo seguro y deniega lo arriesgado sin preguntar (nadie mira). Respeta las reglas deny de settings.
    # Out-Host: la salida va a la ventana y al registro, pero no se convierte en valor de retorno de la funcion
    # (sin el, $reset recibia el texto de Claude y el bucle relanzaba sin esperar).
    & claude -p $instruction --permission-mode auto --permission-prompts none 2>&1 | Tee-Object -FilePath $runLog | Out-Host
    $exit = $LASTEXITCODE
    Pop-Location

    $output = Get-Content $runLog -Raw -ErrorAction SilentlyContinue
    if ($output -match '(?i)(usage limit|session limit|limit reached|hit your .*limit|rate.?limit)') {
      $reset = Get-ResetTime $output
      if ($reset) { Write-Log "Limite de uso alcanzado. Se reanudara a las $($reset.ToString('HH:mm'))." }
      else { Write-Log 'Limite de uso alcanzado. Se reintentara en la siguiente comprobacion.' }
      if (-not $reset) { $reset = (Get-Date).AddMinutes($IntervalMinutes) }
      return $reset
    }
    Write-Log "Ejecucion terminada (codigo $exit)."
    return $null
  } finally {
    Remove-Item $Lock -ErrorAction SilentlyContinue
  }
}

if ($Once) {
  Invoke-AutopilotRun | Out-Null
  exit 0
}

Write-Log '=== Piloto automatico iniciado (arranque de Windows) ==='
Start-DevServices
Open-Project
Start-Sleep -Seconds $StartupDelaySeconds

while ($true) {
  # Solo cuenta una fecha de reseteo: cualquier otra salida que se cuele de la funcion se ignora.
  $reset = Invoke-AutopilotRun | Where-Object { $_ -is [datetime] } | Select-Object -Last 1
  $next = if ($reset) { $reset.AddMinutes(2) } else { (Get-Date).AddMinutes($IntervalMinutes) }
  Write-Log "Proxima comprobacion: $($next.ToString('yyyy-MM-dd HH:mm'))."
  $wait = [Math]::Max(60, [int]($next - (Get-Date)).TotalSeconds)
  Start-Sleep -Seconds $wait
}
