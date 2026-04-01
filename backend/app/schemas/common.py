"""统一 API 响应与分页。"""
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = Field(0, description="0 表示成功")
    message: str = "ok"
    data: Optional[T] = None


class PageResult(BaseModel, Generic[T]):
    items: List[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
