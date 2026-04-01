"""微信登录。"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.orm import User
from app.schemas.common import ApiResponse
from app.config import settings
from app.redis_client import get_redis
from app.security import create_access_token
from app.services import wechat

router = APIRouter(prefix="/api/auth", tags=["auth"])


class WxLoginBody(BaseModel):
    code: str = Field(..., min_length=4, max_length=256)


@router.post("/wx-login", response_model=ApiResponse[dict])
async def wx_login(body: WxLoginBody, db: Session = Depends(get_db)):
    try:
        openid, _, _ = await wechat.code_to_openid(body.code)
    except Exception as e:
        return ApiResponse(code=40001, message=f"微信登录失败: {e!s}", data=None)

    try:
        user = db.query(User).filter(User.openid == openid).first()
        if not user:
            user = User(openid=openid, nickname="微信用户", avatar="")
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.nickname = user.nickname or "微信用户"
            db.commit()

        token = create_access_token(str(user.id), extra={"uid": user.id, "openid": openid})
        try:
            r = get_redis()
            ttl = int(settings.jwt_expire_minutes * 60)
            r.setex(f"auth:token:{user.id}", ttl, token)
        except Exception:
            pass

        return ApiResponse(
            data={
                "token": token,
                "user": {
                    "id": user.id,
                    "openid": openid,
                    "nickname": user.nickname,
                    "avatar": user.avatar,
                },
            }
        )
    except SQLAlchemyError as e:
        return ApiResponse(
            code=50001,
            message=(
                "数据库错误，无法完成登录。若未安装 MySQL，请在 backend/.env 设置 USE_SQLITE=true（默认已开启），"
                "并重启 uvicorn；或安装 MySQL 后执行 sql/init.sql。详情："
                + str(e)
            ),
            data=None,
        )
