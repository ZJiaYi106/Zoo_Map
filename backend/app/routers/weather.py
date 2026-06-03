"""天气接口。"""
from fastapi import APIRouter

from app.schemas.common import ApiResponse
from app.services.weather import get_hourly

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/hourly", response_model=ApiResponse[list[dict]])
def weather_hourly(hours: int = 5):
    """未来 N 小时天气预报（默认 5 小时）。"""
    data = get_hourly(hours=hours)
    # 精简返回字段，前端只需这些
    items = [
        {
            "time": h.get("fxTime", ""),
            "temp": h.get("temp", ""),
            "icon": h.get("icon", ""),
            "text": h.get("text", ""),
            "windDir": h.get("windDir", ""),
            "windScale": h.get("windScale", ""),
            "humidity": h.get("humidity", ""),
            "precip": h.get("precip", ""),
            "pop": h.get("pop", ""),
        }
        for h in data
    ]
    return ApiResponse(data=items)
