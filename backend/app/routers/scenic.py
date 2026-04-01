"""景点数据接口。"""
from typing import Optional, Set

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_optional
from app.models.orm import Collection, Scenic, User
from app.schemas.common import ApiResponse, PageResult

router = APIRouter(prefix="/api/scenic", tags=["scenic"])


@router.get("/list", response_model=ApiResponse[PageResult[dict]])
def scenic_list(
    category: Optional[str] = Query(None, description="猛兽区/食草区/鸟类区"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    q = db.query(Scenic)
    if category:
        q = q.filter(Scenic.category == category)
    total = q.count()
    rows = (
        q.order_by(Scenic.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    fav_ids: Set[int] = set()
    if user:
        fav_ids = {
            r.scenic_id
            for r in db.query(Collection.scenic_id)
            .filter(Collection.user_id == user.id)
            .all()
        }
    items = [
        {
            "id": r.id,
            "name": r.name,
            "intro": r.intro,
            "image": r.image,
            "longitude": r.longitude,
            "latitude": r.latitude,
            "category": r.category,
            "cost_time": r.cost_time,
            "difficulty": r.difficulty,
            "collected": r.id in fav_ids,
        }
        for r in rows
    ]
    return ApiResponse(data=PageResult(items=items, total=total, page=page, page_size=page_size))
