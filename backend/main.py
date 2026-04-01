"""
FastAPI 主入口：跨域、路由注册、统一异常（简要）。
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine
from app.routers import ai, auth, chat, collection, facility, scenic

app = FastAPI(title=settings.app_name, version="1.0.0")


@app.on_event("startup")
async def _create_tables():
    """启动时建表（SQLite 开箱即用；MySQL 也可配合 init.sql）。"""
    import app.models.orm  # noqa: F401 — 注册所有 ORM 到 Base.metadata

    Base.metadata.create_all(bind=engine)

# 允许微信小程序 / 本地开发工具访问（上线请收紧为正式域名）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"code": 422, "message": "参数校验失败", "data": exc.errors()},
    )


@app.get("/")
def root():
    """根路径：确认当前进程是本项目 FastAPI，避免 404 误判。"""
    return {
        "code": 0,
        "message": "ok",
        "data": {"service": settings.app_name, "health": "/health", "auth_login": "POST /api/auth/wx-login"},
    }


@app.get("/health")
def health():
    return {"code": 0, "message": "ok", "data": {"status": "up"}}


@app.get("/health/db")
def health_db():
    """检查数据库是否可连接（登录依赖 DB，此接口便于排查 500）。"""
    from sqlalchemy.exc import SQLAlchemyError

    from app.database import SessionLocal

    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "db": "sqlite" if settings.use_sqlite else "mysql",
                "ok": True,
            },
        }
    except SQLAlchemyError as e:
        return {
            "code": 50001,
            "message": f"数据库不可用: {e!s}",
            "data": {"ok": False},
        }


app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(scenic.router)
app.include_router(facility.router)
app.include_router(collection.router)
app.include_router(chat.router)
