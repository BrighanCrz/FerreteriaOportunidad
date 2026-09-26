@echo off
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar ERP.ps1"
if errorlevel 1 pause
