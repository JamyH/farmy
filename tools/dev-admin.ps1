# FarmyDevBuild als Admin (neu) starten, ohne UAC-Fenster. Läuft über die geplante Aufgabe „FarmyDevBuild“
# (höchste Rechte), die Desktop-Verknüpfung ruft nur `schtasks /run /tn FarmyDevBuild` auf.
# Beendet ein laufendes Dev-Build (sonst greift die Single-Instance-Sperre) und startet es mit dem Datenordner auf D:.
# Aufgabe einmalig anlegen (Admin-PowerShell): tools\dev-admin.ps1 -Register
param([switch]$Register)

$root = Split-Path $PSScriptRoot -Parent
$exe = Join-Path $root 'node_modules\electron\dist\electron.exe'

if ($Register) {
  # ohne Admin-Shell: sich selbst einmal als Admin neu starten (ein UAC-Fenster)
  $me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Register"
    return
  }
  $run = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  try {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $root -Argument $run
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0
    Register-ScheduledTask -TaskName 'FarmyDevBuild' -Action $action -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
  } catch {
    # zweiter Weg über schtasks.exe (Startzeit egal, die Aufgabe wird nur per /run gestartet)
    Write-Host "Register-ScheduledTask: $($_.Exception.Message) - versuche schtasks"
    schtasks.exe /Create /F /TN FarmyDevBuild /RL HIGHEST /IT /SC ONCE /ST 00:00 /TR "powershell.exe $run"
  }
  if (Get-ScheduledTask -TaskName 'FarmyDevBuild' -ErrorAction SilentlyContinue) { Write-Host 'FarmyDevBuild eingerichtet.' -ForegroundColor Green }
  else { Write-Host 'FarmyDevBuild konnte nicht angelegt werden.' -ForegroundColor Red }
  Read-Host 'Enter zum Schließen'
  return
}

# Hauptprozess = electron.exe aus diesem Ordner ohne --type= (die anderen sind Renderer/GPU-Kinder)
$main = { Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.ExecutablePath -eq $exe } }
& $main | Where-Object { $_.CommandLine -notmatch '--type=' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
for ($i = 0; $i -lt 20 -and (& $main); $i++) { Start-Sleep -Milliseconds 250 }

Start-Process -FilePath $exe -ArgumentList '.', "--data-dir=$root\userdata" -WorkingDirectory $root
