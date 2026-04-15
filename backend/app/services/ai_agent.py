"""
AI 智能体编排：意图理解 + 知识库检索 + 结构化输出。
"""
import json
import re
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.orm import Scenic
from app.services import knowledge_base, prompts
from app.services.llm_client import chat_completion


def infer_demand_type(text: str, hint: Optional[str]) -> str:
    """结合前端 hint 与关键词的意图理解。"""
    if hint in ("route_planning", "scenic_guide", "qa", "checkin"):
        return hint
    t = text.lower()
    if any(k in t for k in ["打卡", "拍", "机位", "角度", "参数"]):
        return "checkin"
    if any(k in t for k in ["讲解", "介绍", "历史", "景点"]):
        return "scenic_guide"
    if any(k in t for k in ["路线", "规划", "老人", "亲子", "小时", "游"]):
        return "route_planning"
    return "qa"


def _format_route_json_for_user(obj: Dict[str, Any]) -> str:
    """将路线 JSON 转为用户可见的纯中文说明（不向用户暴露 JSON 键名）。"""
    name = (obj.get("route_name") or "推荐游览路线").strip()
    minutes = obj.get("duration_minutes")
    diff = (obj.get("difficulty") or "适中").strip()
    summary = (obj.get("summary") or "").strip()
    crowd = (obj.get("crowding_hint") or "").strip()
    poly = (obj.get("polyline_hint") or "").strip()
    points = obj.get("points") or []

    lines: list[str] = []
    lines.append(f"为您规划：{name}")
    if minutes is not None:
        lines.append(f"预计全程约 {minutes} 分钟，体力难度：{diff}。")
    else:
        lines.append(f"体力难度：{diff}。")
    if summary:
        lines.append(summary)
    if crowd:
        lines.append(f"游园提示：{crowd}")
    if poly:
        lines.append(f"行走建议：{poly}")

    if points:
        lines.append("\n【建议游览顺序】")
        for i, p in enumerate(points, 1):
            if not isinstance(p, dict):
                continue
            pname = (p.get("name") or "景点").strip()
            stay = p.get("stay_minutes")
            note = (p.get("note") or "").strip()
            seg = f"{i}. {pname}"
            if stay is not None:
                seg += f"（建议停留约 {stay} 分钟）"
            lines.append(seg)
            if note:
                lines.append(f"   · {note}")

    lines.append(
        "\n温馨提示：园内请遵守安全规定，勿投喂、勿敲打玻璃；以上路线为智能规划参考，请以现场指引与当日公告为准。"
    )
    return "\n".join(lines).strip()


async def run_route_planning(db: Session, user_text: str) -> Tuple[str, str]:
    """
    返回 (用户可见的中文说明, 原始 JSON 字符串)。
    前端聊天只展示第一段；API 可把第二段放入 route 字段供地图使用。
    """
    rows = db.query(Scenic).limit(50).all()
    ctx = [
        {
            "name": r.name,
            "category": r.category,
            "lng": r.longitude,
            "lat": r.latitude,
            "cost_time": r.cost_time,
            "difficulty": r.difficulty,
        }
        for r in rows
    ]
    u = prompts.build_user_route(user_text, json.dumps(ctx, ensure_ascii=False))
    raw = await chat_completion(prompts.SYSTEM_ROUTE, u, temperature=0.3)
    raw = raw.strip()
    if not raw.startswith("{"):
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            raw = m.group(0)
    try:
        json.loads(raw)
    except Exception:
        raw = await chat_completion(
            prompts.SYSTEM_ROUTE + "\n若上一版非合法 JSON，请仅输出修正后的 JSON。",
            u,
            temperature=0.2,
        )
        raw = raw.strip()
        if not raw.startswith("{"):
            m = re.search(r"\{[\s\S]*\}", raw)
            if m:
                raw = m.group(0)

    try:
        obj = json.loads(raw)
        if not isinstance(obj, dict):
            raise ValueError("not an object")
        reply = _format_route_json_for_user(obj)
        return reply, raw
    except Exception:
        fallback = (
            "抱歉，本次路线规划未能生成结构化结果，请换种说法重试，或稍后再试。"
            "\n若问题持续，请到游客服务中心咨询当日推荐路线。"
        )
        return fallback, raw


async def run_scenic_guide(scenic_name: str) -> str:
    u = prompts.build_user_scenic(scenic_name)
    return await chat_completion(prompts.SYSTEM_SCENIC, u, temperature=0.5)


async def run_qa(user_text: str) -> str:
    chunks = knowledge_base.retrieve_chunks(user_text, top_k=5)
    kb = "\n".join(f"- ({c['id']}) {c['text']}" for c in chunks)
    u = prompts.build_user_qa(user_text, kb)
    return await chat_completion(prompts.SYSTEM_QA, u, temperature=0.2)


async def run_checkin(user_text: str, meta: str) -> str:
    u = prompts.build_user_checkin(user_text, meta)
    return await chat_completion(prompts.SYSTEM_CHECKIN, u, temperature=0.6)


async def run_chat_pipeline(
    db: Session,
    user_text: str,
    demand_type: Optional[str],
) -> Tuple[str, str, Optional[Dict[str, Any]]]:
    """
    返回 (plain_reply, normalized_type, extra)。
    extra 可含 route JSON 用于前端/地图。
    """
    dt = infer_demand_type(user_text, demand_type)
    extra: Optional[Dict[str, Any]] = None

    if dt == "route_planning":
        reply_text, raw_json = await run_route_planning(db, user_text)
        extra = {"route_json": raw_json}
        return reply_text, dt, extra

    if dt == "scenic_guide":
        # 从文本中提取景点名：简单取前 20 字或整句
        name = user_text.strip()[:20]
        text = await run_scenic_guide(name)
        return text, dt, extra

    if dt == "checkin":
        meta = "当前时间/天气由客户端补充；园区默认北戴河新区气候多变，注意防风防晒。"
        text = await run_checkin(user_text, meta)
        return text, dt, extra

    text = await run_qa(user_text)
    return text, dt, extra
