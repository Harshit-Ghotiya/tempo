@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo   Tempo: Installation & Environment Check    
echo =============================================

set PY=
where python >nul 2>nul
if %errorlevel% equ 0 set PY=python
if not defined PY (
    where py >nul 2>nul
    if %errorlevel% equ 0 set PY=py
)
if not defined PY (
    where python3 >nul 2>nul
    if %errorlevel% equ 0 set PY=python3
)

if defined PY (
    for /f "tokens=*" %%v in ('%PY% --version 2^>^&1') do echo [OK] Python found: %%v
) else (
    echo [WARNING] Python was not found in PATH.
    echo Please install Python (3.9+) from python.org and ensure "Add Python to PATH" is checked.
)

where npm >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] npm found. Installing optional test runner dependencies...
    call npm install --silent
    echo [OK] Automated tests ready. (Run 'npm test' anytime to verify 35 tests).
) else (
    echo [INFO] npm not found. Tests skipped. (The web app only requires Python and a browser).
)

echo.
echo =============================================
echo   Setup Complete!
echo   To launch Tempo, double-click tempo_run.bat
echo   or run: tempo_run.bat (or ./tempo_run in Git Bash)
echo =============================================
echo.
pause
