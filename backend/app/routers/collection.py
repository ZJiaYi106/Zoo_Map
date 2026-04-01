"""用户收藏。"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.orm import Collection, Scenic, User
from app.schemas.common import ApiResponse, PageResult

router = APIRouter(prefix="/api/collection", tags=["collection"])


class ToggleBody(BaseModel):
    scenic_id: int = Field(..., ge=1)
    collect: bool = True


@router.post("/toggle", response_model=ApiResponse[dict])
def toggle_collection(
    body: ToggleBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ex = (
        db.query(Collection)
        .filter(Collection.user_id == user.id, Collection.scenic_id == body.scenic_id)
        .first()
    )
    if body.collect:
        if not ex:
            db.add(Collection(user_id=user.id, scenic_id=body.scenic_id))
        db.commit()
        return ApiResponse(data={"collected": True})
    if ex:
        db.delete(ex)
        db.commit()
    return ApiResponse(data={"collected": False})


@router.get("/list", response_model=ApiResponse[PageResult[dict]])
def list_collections(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    total = db.query(Collection).filter(Collection.user_id == user.id).count()
    q = (
        db.query(Scenic, Collection)
        .join(Collection, Collection.scenic_id == Scenic.id)
        .filter(Collection.user_id == user.id)
        .order_by(Collection.create_time.desc())
    )
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = [
        {
            "id": s.id,
            "name": s.name,
            "intro": s.intro,
            "image": s.image,
            "longitude": s.longitude,
            "latitude": s.latitude,
            "category": s.category,
            "cost_time": s.cost_time,
            "difficulty": s.difficulty,
            "collected": True,
        }
        for s, _c in rows
    ]
    return ApiResponse(data=PageResult(items=items, total=total, page=page, page_size=page_size))
