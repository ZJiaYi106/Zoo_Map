"""百度 AI 动物识别服务。每天 500 次免费额度。"""
import time
from typing import Optional

import httpx

from app.config import settings

# 内存缓存 access_token（有效期 30 天，这里缓存 29 天）
_cached_token: Optional[str] = None
_cached_token_expires_at: float = 0.0

_BAIDU_OAUTH_URL = "https://aip.baidubce.com/oauth/2.0/token"
_BAIDU_ANIMAL_API = "https://aip.baidubce.com/rest/2.0/image-classify/v1/animal"


async def _get_access_token() -> str:
    global _cached_token, _cached_token_expires_at
    now = time.time()
    if _cached_token and now < _cached_token_expires_at:
        return _cached_token

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _BAIDU_OAUTH_URL,
            params={
                "grant_type": "client_credentials",
                "client_id": settings.baidu_ai_api_key,
                "client_secret": settings.baidu_ai_secret_key,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        _cached_token = data["access_token"]
        # 提前 1 天过期，避免边界情况
        _cached_token_expires_at = now + data.get("expires_in", 2592000) - 86400
        return _cached_token


async def recognize_animal(image_base64: str) -> dict:
    """识别图片中的动物，返回 {'name': str, 'score': float}。"""
    if not settings.baidu_ai_api_key or not settings.baidu_ai_secret_key:
        return _mock_recognize(image_base64)

    token = await _get_access_token()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{_BAIDU_ANIMAL_API}?access_token={token}",
            data={"image": image_base64},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        body = resp.json()

    results = body.get("result") or []
    if not results:
        return {"name": "未知动物", "score": 0.0}

    top = results[0]
    return {"name": top.get("name", "未知动物"), "score": float(top.get("score", 0.0))}


def _mock_recognize(_image_base64: str) -> dict:
    """无 API Key 时的演示结果。"""
    return {"name": "东北虎", "score": 0.92}
