"""数据库连接与会话（支持 MySQL 或本地 SQLite 开发模式）。"""
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

# backend 目录（.../LittleApp/backend）
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if settings.use_sqlite:
    data_dir = os.path.join(BACKEND_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "dev.db")
    # Windows 路径转 SQLAlchemy 可识别的 URL
    DATABASE_URL = "sqlite:///" + db_path.replace("\\", "/")
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    DATABASE_URL = (
        f"mysql+pymysql://{settings.mysql_user}:{settings.mysql_password}"
        f"@{settings.mysql_host}:{settings.mysql_port}/{settings.mysql_db}?charset=utf8mb4"
    )
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
