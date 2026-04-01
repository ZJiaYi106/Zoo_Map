"""微信 code2session。"""
import hashlib
from typing import Optional, Tuple

import httpx

from app.config import settings


async def code_to_openid(code: str) -> Tuple[str, Optional[str], Optional[str]]:
    """
    返回 (openid, session_key, unionid)。
    MOCK 模式：用 code 派生稳定 openid，便于本地调试。
    """
    if settings.mock_wx_login or not settings.wx_appid or not settings.wx_secret:
        digest = hashlib.sha256(f"mock-{code}".encode()).hexdigest()[:28]
        return (f"mock_{digest}", None, None)

    url = (
        "https://api.weixin.qq.com/sns/jscode2session"
        f"?appid={settings.wx_appid}&secret={settings.wx_secret}&js_code={code}&grant_type=authorization_code"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()
    if "errcode" in data and data["errcode"] != 0:
        raise RuntimeError(data.get("errmsg", "wechat error"))
    return (data["openid"], data.get("session_key"), data.get("unionid"))
