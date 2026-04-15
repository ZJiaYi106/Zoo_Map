"""
把数据库里的景点、设施转成可注入大模型的「本园事实」文本。
外部 API 并不预先知道你的项目；靠每次请求携带这些片段 + 系统提示约束回答范围。
"""
from sqlalchemy.orm import Session

from app.models.orm import Facility, Scenic


def build_project_context_for_prompt(db: Session, max_chars: int = 6000) -> str:
    lines: list[str] = [
        "以下为秦皇岛野生动物园小程序后端数据库中的景点与设施（回答用户时请优先引用其中的名称与说明，勿编造不存在的点位）。",
        "",
        "【景点/展区】",
    ]
    for s in db.query(Scenic).limit(80).all():
        intro = (s.intro or "").strip().replace("\n", " ")[:200]
        lines.append(
            f"- {s.name}｜分类:{s.category}｜建议用时:{s.cost_time}｜难度:{s.difficulty}"
            + (f"｜简介:{intro}" if intro else "")
        )
    lines.extend(["", "【服务设施】"])
    for f in db.query(Facility).limit(80).all():
        intro = (f.intro or "").strip().replace("\n", " ")[:120]
        lines.append(f"- {f.name}｜类型:{f.type}" + (f"｜{intro}" if intro else ""))

    text = "\n".join(lines)
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 20] + "\n…(已截断，仍以数据库为准)"
