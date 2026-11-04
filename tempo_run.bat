@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo   Starting Tempo at: http://localhost:8000
echo   Video never leaves browser. Press Ctrl+C to stop.
echo =============================================

rem Automatically launch default browser after 1 second
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8000"

where python >nul 2>nul
if %errorlevel% equ 0 (
    python -m http.server 8000 --bind 127.0.0.1
    goto end
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    py -m http.server 8000 --bind 127.0.0.1
    goto end
)

where python3 >nul 2>nul
if %errorlevel% equ 0 (
    python3 -m http.server 8000 --bind 127.0.0.1
    goto end
)

echo [ERROR] Python is not installed or not in PATH.
echo Please install Python 3 from python.org (check "Add Python to PATH").
pause

:end
