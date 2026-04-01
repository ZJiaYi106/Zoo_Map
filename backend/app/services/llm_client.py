"""大模型调用（OpenAI 兼容 Chat Completions）。"""
import json
from typing import Any, Dict

import httpx

from app.config import settings


async def chat_completion(
    system: str,
    user: str,
    temperature: float = 0.4,
) -> str:
    """返回 assistant 文本内容。"""
    if not settings.llm_api_key and settings.allow_mock_llm:
        return _mock_reply(system, user)

    url = settings.llm_api_base.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    payload: Dict[str, Any] = {
        "model": settings.llm_model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
    return data["choices"][0]["message"]["content"]


def _mock_reply(system: str, user: str) -> str:
    """无 Key 时的本地模拟，保证接口可演示。"""
    if "SYSTEM_ROUTE" in system or "步行导览" in system:
        return json.dumps(
            {
                "route_name": "示例轻松环线",
                "duration_minutes": 90,
                "difficulty": "轻松",
                "summary": "猛兽区观景台—食草动物区—中央服务区，适合老人与儿童。",
                "crowding_hint": "上午相对舒适，午间主路人流略多。",
                "polyline_hint": "沿园区主干道逆时针小环线。",
                "points": [
                    {"name": "猛兽区观景台", "lng": 119.5965, "lat": 39.9402, "stay_minutes": 20, "note": "观景不投喂"},
                    {"name": "食草动物区", "lng": 119.5988, "lat": 39.9395, "stay_minutes": 25, "note": "亲子观察"},
                    {"name": "中央超市", "lng": 119.5975, "lat": 39.939, "stay_minutes": 15, "note": "补水休息"},
                ],
            },
            ensure_ascii=False,
        )
    if "讲解员" in system:
        return (
            f"{user} 以生态展示与科普教育为特色，参观时请保持安静，勿投喂。"
            "拍照建议使用自然光、避开玻璃反光，长焦更安全。"
            "注意台阶与儿童安全。"
        )[:200]
    if "问答助手" in system:
        return (
            "根据园区公开知识：猛兽区严禁下车与投喂；卫生间与补给可在主干道服务区附近寻找。"
            "若需票价与开放时间等精确信息，请以现场公告为准。"
        )
    if "摄影" in system or "打卡" in system:
        return (
            "时段建议：上午光线柔和，适合猛兽区观景台顺光拍摄。\n"
            "角度：略微俯拍可避开人群；注意栏杆与阴影。\n"
            "参数：手机可用「人像/2x」焦段，ISO 自动即可，开启 HDR 减少过曝。"
        )
    return "（演示模式）请配置 LLM_API_KEY 以启用真实大模型回复。"
