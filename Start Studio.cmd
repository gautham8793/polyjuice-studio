@echo off
rem Polyjuice Video Studio: starts the dashboard and opens it in the browser. Close this window to stop.
cd /d "%~dp0"
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3200"
npm run dashboard
