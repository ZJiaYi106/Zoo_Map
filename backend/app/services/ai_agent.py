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


async def run_route_planning(db: Session, user_text: str) -> str:
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
            user_text,
            temperature=0.2,
        )
    return raw


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
        raw = await run_route_planning(db, user_text)
        extra = {"route_json": raw}
        return raw, dt, extra

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
