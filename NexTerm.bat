@echo off
:: NexTerm Portable Launcher
:: Double-click to run. If you made code changes, use run.bat instead.
cd /d "%~dp0"
if exist "release\win-unpacked\NexTerm.exe" (
    start "" "release\win-unpacked\NexTerm.exe"
) else (
    echo Portable build not found. Building...
    call npm run build
    start "" "node_modules\electron\dist\electron.exe" dist\main\main.js
)
