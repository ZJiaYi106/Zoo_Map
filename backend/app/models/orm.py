"""ORM 模型。"""
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, Float, Integer, String, Text, UniqueConstraint

from app.database import Base


class User(Base):
    __tablename__ = "user"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    openid = Column(String(64), unique=True, nullable=False, index=True)
    nickname = Column(String(128), default="游客")
    avatar = Column(String(512), default="")
    create_time = Column(DateTime, default=datetime.utcnow)
    update_time = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Scenic(Base):
    __tablename__ = "scenic"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False)
    intro = Column(Text)
    image = Column(String(512), default="")
    longitude = Column(Float, nullable=False)
    latitude = Column(Float, nullable=False)
    category = Column(String(32), nullable=False, index=True)
    cost_time = Column(String(32), default="约30分钟")
    difficulty = Column(String(32), default="轻松")


class Facility(Base):
    __tablename__ = "facility"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False)
    type = Column(String(32), nullable=False, index=True)
    longitude = Column(Float, nullable=False)
    latitude = Column(Float, nullable=False)
    distance = Column(String(64), default="")
    intro = Column(Text)


class Collection(Base):
    __tablename__ = "collection"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    scenic_id = Column(BigInteger, nullable=False, index=True)
    create_time = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "scenic_id", name="uk_user_scenic"),)


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    user_input = Column(Text)
    ai_output = Column(Text)
    create_time = Column(DateTime, default=datetime.utcnow)
    type = Column(String(64), default="qa")
