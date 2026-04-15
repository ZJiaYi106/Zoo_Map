"""应用配置：自环境变量加载。"""
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

# 固定从 backend/.env 读取，避免从仓库根目录启动 uvicorn 时读不到环境变量（会导致一直走 Mock）
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "qhd-wildlife-ai"

    # 未装 MySQL 时设为 true，使用本地 SQLite（backend/data/dev.db），避免登录接口 500
    use_sqlite: bool = True

    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_db: str = "qhd_zoo"

    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: Optional[str] = None

    wx_appid: str = ""
    wx_secret: str = ""
    mock_wx_login: bool = True

    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 60 * 24 * 7

    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    allow_mock_llm: bool = True


settings = Settings()


def get_llm_health_snapshot() -> dict:
    """供 /health/llm 与 /api/ai/health-llm 使用；不返回 Key 明文。"""
    key = (settings.llm_api_key or "").strip()
    has_key = len(key) > 0
    will_mock = (not has_key) and settings.allow_mock_llm
    return {
        "llm_api_base": settings.llm_api_base,
        "llm_model": settings.llm_model,
        "llm_key_loaded": has_key,
        "allow_mock_llm": settings.allow_mock_llm,
        "will_use_mock_reply": will_mock,
        "env_file_read": str(_BACKEND_ROOT / ".env"),
    }
