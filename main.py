from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app_locks import MAINTENANCE_MODE
from app_runtime import STATIC_DIR
from database import init_db
from db.migrations import upgrade_database_to_head
from routers.imports import router as imports_router
from routers.items import router as items_router
from routers.system import router as system_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时执行数据库迁移并初始化数据库。"""
    upgrade_database_to_head()
    await init_db()
    yield


app = FastAPI(title="办公用品采购系统", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.middleware("http")
async def maintenance_mode_guard(request, call_next):
    if MAINTENANCE_MODE.is_set():
        path = request.url.path
        if path.startswith("/api") and path not in {"/api/restore", "/api/webdav/restore"}:
            return JSONResponse(
                status_code=503,
                content={"detail": "系统正在执行数据恢复，请稍后重试"},
            )
    return await call_next(request)


app.include_router(system_router)
app.include_router(items_router)
app.include_router(imports_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
