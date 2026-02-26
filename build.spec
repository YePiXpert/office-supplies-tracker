# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import (
    collect_data_files,
    collect_dynamic_libs,
    collect_submodules,
)

PROJECT_DIR = Path(globals().get("SPECPATH", ".")).resolve()

hiddenimports = [
    "uvicorn",
    "paddleocr",
    "cv2",
    "shapely",
    "database",
    "main",
    "parser",
]

for pkg in ("uvicorn", "fastapi", "starlette", "webview", "paddleocr"):
    hiddenimports += collect_submodules(pkg)

# 去重并排序，避免重复项导致日志噪音
hiddenimports = sorted(set(hiddenimports))

datas = [
    (str(PROJECT_DIR / "static"), "static"),
    (str(PROJECT_DIR / "uploads"), "uploads"),
    (str(PROJECT_DIR / "README.md"), "."),
    (str(PROJECT_DIR / "USAGE.md"), "."),
]

datas += collect_data_files("webview")
datas += collect_data_files("paddleocr")

binaries = []
binaries += collect_dynamic_libs("cv2")
binaries += collect_dynamic_libs("paddle")

a = Analysis(
    ["desktop.py"],
    pathex=[str(PROJECT_DIR)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="office-supplies-desktop",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="office-supplies-desktop",
)
