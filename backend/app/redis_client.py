"""Redis 客户端单例。"""
from typing import Optional

import redis

from app.config import settings

_redis: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        kwargs = dict(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            decode_responses=True,
        )
        if settings.redis_password:
            kwargs["password"] = settings.redis_password
        _redis = redis.Redis(**kwargs)
    return _redis
