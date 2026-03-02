@echo off
setlocal EnableExtensions

cd /d "%~dp0\.." || (
  echo [ERROR] Cannot enter project root.
  exit /b 1
)

set "PY=venv\Scripts\python.exe"
if not exist "%PY%" (
  echo [ERROR] venv\Scripts\python.exe not found.
  echo Run start_windows.bat first.
  exit /b 1
)

echo [1/2] Installing dependencies...
call "%PY%" -m pip install -r requirements.txt
if errorlevel 1 goto :fail

echo [2/2] Building exe with PyInstaller...
call "%PY%" -m pyinstaller --noconfirm --clean --windowed --name OfficeSuppliesTracker --add-data "static;static" --collect-all webview --hidden-import uvicorn.loops.auto --hidden-import uvicorn.protocols.http.auto --hidden-import uvicorn.protocols.websockets.auto --hidden-import uvicorn.lifespan.on desktop.py
if errorlevel 1 goto :fail

echo.
echo Build success:
echo dist\OfficeSuppliesTracker\OfficeSuppliesTracker.exe
exit /b 0

:fail
echo.
echo [ERROR] Build failed.
exit /b 1
