"""设施数据接口。"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.orm import Facility
from app.schemas.common import ApiResponse, PageResult

router = APIRouter(prefix="/api/facility", tags=["facility"])


@router.get("/list", response_model=ApiResponse[PageResult[dict]])
def facility_list(
    facility_type: str = Query(..., alias="type", description="厕所/超市/观景台/休息区"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Facility).filter(Facility.type == facility_type)
    total = q.count()
    rows = (
        q.order_by(Facility.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        {
            "id": r.id,
            "name": r.name,
            "type": r.type,
            "longitude": r.longitude,
            "latitude": r.latitude,
            "distance": r.distance,
            "intro": r.intro or "",
        }
        for r in rows
    ]
    return ApiResponse(data=PageResult(items=items, total=total, page=page, page_size=page_size))
