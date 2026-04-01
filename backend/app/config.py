"""应用配置：自环境变量加载。"""
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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
