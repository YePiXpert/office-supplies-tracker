@echo off
setlocal EnableExtensions

cd /d "%~dp0" || (
  echo [ERROR] Cannot enter project directory.
  exit /b 1
)

set "FORCE_INSTALL=0"
if /I "%~1"=="--reinstall" set "FORCE_INSTALL=1"

set "PY_BOOTSTRAP=python"
where py >nul 2>nul
if not errorlevel 1 set "PY_BOOTSTRAP=py -3"

if not exist "venv\Scripts\python.exe" (
  echo [1/3] Creating virtual environment...
  %PY_BOOTSTRAP% -m venv venv
  if errorlevel 1 (
    echo [ERROR] Failed to create venv. Install Python 3.10+ first.
    pause
    exit /b 1
  )
)

set "PY=venv\Scripts\python.exe"
set "DEPS_MARKER=venv\.deps_installed"
if "%FORCE_INSTALL%"=="1" del /f /q "%DEPS_MARKER%" >nul 2>nul

if not exist "%DEPS_MARKER%" (
  echo [2/3] Installing dependencies...
  call "%PY%" -m pip install --upgrade pip
  if errorlevel 1 goto :fail
  call "%PY%" -m pip install -r requirements.txt
  if errorlevel 1 goto :fail
  >"%DEPS_MARKER%" echo ok
) else (
  echo [2/3] Dependencies already installed. Skipping.
)

echo [3/3] Starting desktop app...
call "%PY%" desktop.py
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo [ERROR] Startup failed.
pause
exit /b 1
