"""JWT 签发与校验。"""
import time
from typing import Any, Dict, Optional

import jwt

from app.config import settings


def create_access_token(sub: str, extra: Optional[Dict[str, Any]] = None) -> str:
    now = int(time.time())
    payload: Dict[str, Any] = {
        "sub": sub,
        "iat": now,
        "exp": now + settings.jwt_expire_minutes * 60,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
