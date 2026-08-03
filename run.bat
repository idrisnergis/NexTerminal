@echo off
echo Building NexTerm...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)
echo Starting NexTerm...
start "" "node_modules\electron\dist\electron.exe" dist\main\main.js
