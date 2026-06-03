"""和风天气服务：逐小时预报 + 内存缓存。"""
import time
from typing import Any

import httpx

from app.config import settings

# 内存缓存：{(location, key): (expire_ts, data)}
_cache: dict[tuple[str, str], tuple[float, list[dict[str, Any]]]] = {}
_CACHE_TTL = 1800  # 半小时


def _fetch_hourly(location: str, key: str) -> list[dict[str, Any]]:
    """从和风天气拉取 24h 逐小时预报。"""
    host = (settings.qweather_api_host or "").strip().rstrip("/")
    url = f"{host}/v7/weather/24h"
    resp = httpx.get(url, params={"location": location, "key": key}, timeout=10.0)
    resp.raise_for_status()
    body = resp.json()
    if body.get("code") != "200":
        raise RuntimeError(f"QWeather error: {body}")
    return body.get("hourly", [])


def get_hourly(hours: int = 5) -> list[dict[str, Any]]:
    """返回未来 N 小时天气预报（缓存半小时）。"""
    key = (settings.qweather_api_key or "").strip()
    location = (settings.qweather_location or "").strip()
    if not key:
        raise RuntimeError("未配置 QWEATHER_API_KEY")

    cache_key = (location, key)
    now = time.time()
    if cache_key in _cache:
        expire_ts, data = _cache[cache_key]
        if now < expire_ts:
            return data[:hours]

    hourly = _fetch_hourly(location, key)
    _cache[cache_key] = (now + _CACHE_TTL, hourly)
    return hourly[:hours]
