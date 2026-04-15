"""对话历史。"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.orm import ChatHistory, User
from app.schemas.common import ApiResponse, PageResult

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/history", response_model=ApiResponse[PageResult[dict]])
def chat_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ChatHistory).filter(ChatHistory.user_id == user.id)
    total = q.count()
    rows = (
        q.order_by(ChatHistory.create_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        {
            "id": r.id,
            "user_input": r.user_input,
            "ai_output": r.ai_output,
            "type": r.type,
            "create_time": r.create_time.isoformat() if r.create_time else "",
        }
        for r in rows
    ]
    return ApiResponse(data=PageResult(items=items, total=total, page=page, page_size=page_size))


@router.delete("/history/clear", response_model=ApiResponse[dict])
def clear_all_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """清空当前用户在服务端的全部 AI 对话记录（与小程序本地缓存需分别清除）。"""
    deleted = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return ApiResponse(data={"deleted": deleted})


@router.delete("/history/{hid}", response_model=ApiResponse[dict])
def delete_history(
    hid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(ChatHistory)
        .filter(ChatHistory.id == hid, ChatHistory.user_id == user.id)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return ApiResponse(data={"deleted": True})
