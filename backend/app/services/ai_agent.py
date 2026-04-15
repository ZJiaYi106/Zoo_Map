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
from app.services.project_context import build_project_context_for_prompt

# 意图兜底：避免「我要去看老虎」等仍落入 qa（演示/旧客户端/关键词漏配）
_WAYFIND_RE = re.compile(
    r"(在哪|哪里|哪有|多远|怎么走|怎么去|带我去|导航到|路线|规划|目的地|超市|厕所|卫生间|洗手间|补给|买水|商店)"
)
_ANIMAL_OR_EXHIBIT_RE = re.compile(
    r"(老虎|东北虎|虎园|狮子|非洲狮|狮虎|长颈鹿|斑马|猛兽|食草|鸟类|水禽|鹦鹉|熊猫|大象|猴子)"
)


def _extract_json_from_model_text(text: str) -> str:
    """去掉 Markdown 代码围栏等，尽量得到可 json.loads 的对象串。"""
    t = (text or "").strip()
    if not t:
        return t
    if "```" in t:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", t, re.IGNORECASE)
        if m:
            t = m.group(1).strip()
    if t.startswith("{"):
        return t
    m = re.search(r"\{[\s\S]*\}", t)
    return m.group(0) if m else t


def infer_demand_type(text: str, hint: Optional[str]) -> str:
    """结合前端 hint 与关键词。快捷按钮会传 route_planning / scenic_guide / checkin；自由输入常带 qa，必须以文本为准再分类。"""
    # 仅小程序「快捷需求」显式指定时强制采用（避免与下面文本推断混用）
    if hint in ("route_planning", "scenic_guide", "checkin"):
        return hint

    raw = (text or "").strip()
    if not raw:
        return "qa"

    if any(k in raw for k in ("打卡", "拍", "机位", "角度", "参数", "摄影")):
        return "checkin"

    # 问路、位置、设施、怎么走、经典路线词 → 交给路线规划（用户原话进模型，可含「去超市」「厕所」）
    route_kw = (
        "在哪",
        "哪里",
        "怎么走",
        "怎么去",
        "带我去",
        "导航",
        "超市",
        "商店",
        "补给",
        "厕所",
        "卫生",
        "洗手",
        "路线",
        "规划",
        "老人",
        "亲子",
        "小时",
        "轻松游",
        "科普路线",
        "游园",
        "游览",
        "游玩",
        "半日游",
        "一日游",
    )
    if any(k in raw for k in route_kw):
        return "route_planning"

    # 想看动物 / 展区讲解（非问路句式）
    scenic_kw = (
        "讲解",
        "介绍",
        "历史",
        "老虎",
        "东北虎",
        "狮子",
        "狮虎",
        "非洲狮",
        "长颈鹿",
        "斑马",
        "猛兽",
        "食草",
        "鸟类",
        "水禽",
        "鹦鹉",
        "参观",
        "看虎",
        "看狮子",
        "看长颈鹿",
    )
    if any(k in raw for k in scenic_kw):
        return "scenic_guide"

    return "qa"


def coerce_demand_type(user_text: str, dt: str) -> str:
    """
    infer 之后再纠偏：旧版前端仍传 qa、或关键词未覆盖时，避免动物/设施类问题掉进通用问答套话。
    """
    if dt in ("route_planning", "scenic_guide", "checkin"):
        return dt
    raw = (user_text or "").strip()
    if not raw:
        return dt

    # 先问路 / 找设施 → 路线
    if _WAYFIND_RE.search(raw):
        return "route_planning"

    # 看动物、去某展区 → 讲解（比泛泛 qa 更贴题）
    if _ANIMAL_OR_EXHIBIT_RE.search(raw) or any(
        k in raw for k in ("看虎", "看狮子", "看长颈鹿", "参观", "想看", "去看")
    ):
        return "scenic_guide"

    return dt


def _extract_scenic_focus(user_text: str) -> str:
    """从自然语言中抽出讲解主题，便于讲解员提示词聚焦。"""
    raw = (user_text or "").strip()
    if not raw:
        return "园内景点"
    pairs = [
        (("东北虎", "老虎", "看虎", "虎园"), "狮虎园与猛兽区（东北虎等）"),
        (("非洲狮", "狮子", "狮虎"), "狮虎园猛兽展示"),
        (("长颈鹿",), "长颈鹿互动广场"),
        (("斑马", "食草动物"), "食草动物区"),
        (("鸟类", "水禽", "鹦鹉", "鸟表演"), "鸟类与水禽展区"),
        (("猛兽",), "猛兽区观景台"),
    ]
    for keys, label in pairs:
        if any(k in raw for k in keys):
            return label
    return raw[:48]


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
    raw = _extract_json_from_model_text(raw)
    try:
        json.loads(raw)
    except Exception:
        raw2 = await chat_completion(
            prompts.SYSTEM_ROUTE + "\n若上一版非合法 JSON，请仅输出修正后的 JSON。",
            u,
            temperature=0.2,
        )
        raw = _extract_json_from_model_text(raw2)

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


async def run_scenic_guide(scenic_name: str, db: Session) -> str:
    project_block = build_project_context_for_prompt(db)
    u = prompts.build_user_scenic(scenic_name, project_block)
    return await chat_completion(prompts.SYSTEM_SCENIC, u, temperature=0.5)


async def run_qa(user_text: str, db: Session) -> str:
    chunks = knowledge_base.retrieve_chunks(user_text, top_k=5)
    kb = "\n".join(f"- ({c['id']}) {c['text']}" for c in chunks)
    project_block = build_project_context_for_prompt(db)
    u = prompts.build_user_qa(user_text, kb, project_block)
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
    dt = coerce_demand_type(user_text, infer_demand_type(user_text, demand_type))
    extra: Optional[Dict[str, Any]] = None

    if dt == "route_planning":
        reply_text, raw_json = await run_route_planning(db, user_text)
        extra = {"route_json": raw_json}
        return reply_text, dt, extra

    if dt == "scenic_guide":
        focus = _extract_scenic_focus(user_text)
        text = await run_scenic_guide(focus, db)
        return text, dt, extra

    if dt == "checkin":
        meta = "当前时间/天气由客户端补充；园区默认北戴河新区气候多变，注意防风防晒。"
        text = await run_checkin(user_text, meta)
        return text, dt, extra

    text = await run_qa(user_text, db)
    return text, dt, extra
