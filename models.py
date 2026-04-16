import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


def generate_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    nickname = Column(String(50), nullable=False, unique=True)
    language = Column(String(10), default="ko")
    profile_visibility = Column(String(20), default="public")  # public/friends/private
    avatar_data = Column(Text, nullable=True)  # base64 AI-generated avatar image
    created_at = Column(DateTime, default=utcnow)

    sessions = relationship("CameraSession", back_populates="user")
    traces = relationship("Trace", back_populates="user")


class CameraSession(Base):
    __tablename__ = "camera_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    is_discoverable = Column(Boolean, default=True)
    mode = Column(String(20), default="normal")  # normal/penpal/explore
    started_at = Column(DateTime, default=utcnow)
    ended_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")


class Connection(Base):
    __tablename__ = "connections"

    id = Column(String, primary_key=True, default=generate_uuid)
    requester_id = Column(String, ForeignKey("users.id"), nullable=False)
    target_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String(20), default="friend")  # friend/temporary
    status = Column(String(20), default="pending")  # pending/accepted/rejected
    created_at = Column(DateTime, default=utcnow)

    requester = relationship("User", foreign_keys=[requester_id])
    target = relationship("User", foreign_keys=[target_id])


class Trace(Base):
    __tablename__ = "traces"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    photo_data = Column(Text, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    heading = Column(Float, nullable=True)
    caption = Column(Text, nullable=True)
    visibility = Column(String(20), default="public")  # public/friends/private
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="traces")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=True)
    language_code = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    sender = relationship("User")
