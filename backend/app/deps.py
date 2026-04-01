"""依赖注入：当前登录用户。"""
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.orm import User
from app.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_optional(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not cred or not cred.credentials:
        return None
    try:
        payload = decode_token(cred.credentials)
        uid = payload.get("uid")
        if not uid:
            return None
    except Exception:
        return None
    return db.query(User).filter(User.id == int(uid)).first()


def get_current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not cred or not cred.credentials:
        raise HTTPException(status_code=401, detail="未登录或 token 缺失")
    try:
        payload = decode_token(cred.credentials)
        uid = payload.get("uid")
        if not uid:
            raise ValueError("no uid")
    except Exception:
        raise HTTPException(status_code=401, detail="token 无效或已过期") from None
    user = db.query(User).filter(User.id == int(uid)).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user
