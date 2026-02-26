@echo off
setlocal

chcp 65001 >nul
cd /d "%~dp0"

echo [1/6] 检查 Python...
set "PY_CMD="
where py >nul 2>&1
if not errorlevel 1 set "PY_CMD=py -3"
if not defined PY_CMD (
    where python >nul 2>&1
    if not errorlevel 1 set "PY_CMD=python"
)
if not defined PY_CMD (
    echo [ERROR] 未找到 Python，请先安装 Python 3.10+ 并加入 PATH。
    goto :error
)
echo 使用命令: %PY_CMD%

if not exist "venv\Scripts\python.exe" (
    echo [2/6] 创建虚拟环境...
    %PY_CMD% -m venv venv
    if errorlevel 1 goto :error
) else (
    echo [2/6] 复用已有虚拟环境...
)

call "venv\Scripts\activate.bat"
if errorlevel 1 goto :error

echo [3/6] 升级打包基础工具...
python -m pip install --upgrade pip setuptools wheel
if errorlevel 1 goto :error

echo [4/6] 安装项目依赖...
pip install -r requirements.txt
if errorlevel 1 goto :error

echo [5/6] 准备离线前端资源...
python scripts\prepare_vendor_assets.py
if errorlevel 1 goto :error

echo [6/6] 开始打包...
pyinstaller --noconfirm --clean build.spec
if errorlevel 1 goto :error

echo.
echo 打包完成: dist\office-supplies-desktop\
echo 可以运行: dist\office-supplies-desktop\office-supplies-desktop.exe
pause
exit /b 0

:error
echo.
echo 打包失败，请检查上面的报错信息。
pause
exit /b 1
