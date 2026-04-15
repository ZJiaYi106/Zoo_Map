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
        # 演示数据随用户问题略作区分，避免两次提问得到完全相同的 JSON 观感
        u = user or ""
        if any(k in u for k in ("老人", "年长", "轮椅", "坡度", "少走")):
            route_name = "示例 · 老人轻松线"
            summary = (
                "以平路、短距离串联观景台与服务区，少爬坡，便于休息与补水。"
            )
            poly = "沿主干道平缓段行进，避开需要长台阶的区域。"
        elif any(k in u for k in ("亲子", "儿童", "科普", "互动")):
            route_name = "示例 · 亲子科普线"
            summary = "串联可观察、可讲解的展区，节奏适中，方便孩子提问与休息。"
            poly = "按逆时针小环，景点间距适中，便于推车与停留。"
        elif any(k in u for k in ("超市", "商店", "补给", "买水", "纪念品")):
            route_name = "示例 · 补给购物线"
            summary = "沿主干道前往中央服务区，串联中央超市与补给点，便于买水、简餐与休息。"
            poly = "以主干道为主，先到中央超市再按指示牌前往下一景点。"
        else:
            route_name = "示例轻松环线"
            summary = "猛兽区观景台—食草动物区—中央服务区，适合家庭出游。"
            poly = "沿园区主干道逆时针小环线。"
        return json.dumps(
            {
                "route_name": route_name,
                "duration_minutes": 90,
                "difficulty": "轻松",
                "summary": summary,
                "crowding_hint": "上午相对舒适，午间主路人流略多。",
                "polyline_hint": poly,
                "points": [
                    {"name": "猛兽区观景台", "lng": 119.5965, "lat": 39.9402, "stay_minutes": 20, "note": "观景不投喂"},
                    {"name": "食草动物区", "lng": 119.5988, "lat": 39.9395, "stay_minutes": 25, "note": "亲子观察"},
                    {"name": "中央超市", "lng": 119.5975, "lat": 39.939, "stay_minutes": 15, "note": "补水休息"},
                ],
            },
            ensure_ascii=False,
        )
    if "讲解员" in system:
        u = user or ""
        if any(k in u for k in ("虎", "狮", "猛兽")):
            body = (
                "狮虎园与猛兽区可观赏东北虎、非洲狮等猛兽，请在指定观景区域活动，勿投喂、勿敲打玻璃。"
                "拍照建议用自然光、避免闪光灯；带儿童请看护好，勿倚靠围栏。"
            )
        elif "长颈鹿" in u or "斑马" in u or "食草" in u:
            body = (
                "食草动物区与长颈鹿互动广场适合亲子观察，动物行为以当日展示为准。"
                "请保持安静与卫生，投喂互动须听从现场工作人员指引。"
            )
        elif "鸟" in u or "水禽" in u or "鹦鹉" in u:
            body = (
                "鸟类与水禽展区环境开阔，注意防风防晒；观鸟时勿惊吓动物，勿向水面投掷杂物。"
            )
        else:
            body = (
                "展区以生态展示与科普教育为特色，参观时请保持安静，勿投喂。"
                "拍照建议自然光、避开玻璃反光；注意台阶与儿童安全。"
            )
        return body[:220]
    if "问答助手" in system:
        q = user or ""
        if "用户问题：" in q:
            q = q.split("用户问题：", 1)[-1].split("\n")[0].strip()
        if any(k in q for k in ("超市", "商店", "买水", "补给", "吃的", "纪念品")):
            return (
                "园内「中央超市」位于中央服务区一带，可购买饮用水、简餐与纪念品；"
                "主干道沿途也有补给点。打开小程序「地图」可把中央超市设为目的地规划步行路线。"
                "具体营业与库存以现场为准。"
            )
        if any(k in q for k in ("厕所", "卫生间", "洗手")):
            return (
                "东门入口附近及主干道沿线设有公共卫生间，部分点位有无障碍设施。"
                "您可在地图页筛选「厕所」类设施查看相对位置。"
            )
        if any(k in q for k in ("老虎", "狮子", "猛兽", "虎园", "狮虎")):
            return (
                "东北虎、非洲狮等猛兽主要在猛兽区 / 狮虎园展示，请在玻璃观景区域参观，严禁投喂、勿用闪光灯。"
                "若问「怎么走」，可在地图里把狮虎园或猛兽区观景台设为目的地进行路线规划。"
            )
        if any(k in q for k in ("门票", "票价", "开放", "几点")):
            return (
                "票价与开放时间随季节与活动调整，请以园区当日公告、售票处或官方渠道为准。"
            )
        return (
            "根据公开游园提示：猛兽区严禁下车与投喂；补给与卫生间多分布在主干道服务区附近。"
            "若您的问题更具体（例如想去哪、看什么动物），可再说详细一点，我能更有针对性地回答。"
        )
    if "摄影" in system or "打卡" in system:
        return (
            "时段建议：上午光线柔和，适合猛兽区观景台顺光拍摄。\n"
            "角度：略微俯拍可避开人群；注意栏杆与阴影。\n"
            "参数：手机可用「人像/2x」焦段，ISO 自动即可，开启 HDR 减少过曝。"
        )
    return "（演示模式）请配置 LLM_API_KEY 以启用真实大模型回复。"
