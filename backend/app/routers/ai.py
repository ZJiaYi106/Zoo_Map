"""AI 对话与景点讲解。"""
import json
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.orm import ChatHistory, User
from app.schemas.common import ApiResponse
from app.services import ai_agent

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatBody(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    demand_type: Optional[str] = Field(
        None,
        description="route_planning|scenic_guide|qa|checkin",
    )
    openid: Optional[str] = None


class ScenicExplainBody(BaseModel):
    scenic_name: str = Field(..., min_length=1, max_length=128)


@router.post("/chat", response_model=ApiResponse[dict])
async def ai_chat(
    body: ChatBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    reply, dt, extra = await ai_agent.run_chat_pipeline(db, body.content, body.demand_type)
    route_obj = None
    if extra and "route_json" in extra:
        try:
            route_obj = json.loads(extra["route_json"])
        except Exception:
            route_obj = {"raw": extra["route_json"]}

    # 持久化对话
    row = ChatHistory(
        user_id=user.id,
        user_input=body.content,
        ai_output=reply,
        type=dt,
    )
    db.add(row)
    db.commit()

    return ApiResponse(
        data={
            "reply": reply,
            "content": reply,
            "demand_type": dt,
            "route": route_obj,
            "tts_url": None,
        }
    )


@router.post("/scenic-explain", response_model=ApiResponse[dict])
async def scenic_explain(
    body: ScenicExplainBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ = db
    text = await ai_agent.run_scenic_guide(body.scenic_name)
    return ApiResponse(data={"content": text, "reply": text})
