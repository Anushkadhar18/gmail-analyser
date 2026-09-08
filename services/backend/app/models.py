from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from .db import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(256), unique=True, index=True, nullable=False)


class Token(Base):
    __tablename__ = "tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    refresh_token = Column(Text, nullable=False)
    scope = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(128), nullable=False)
    meta = Column("metadata", Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Draft(Base):
    __tablename__ = "drafts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    thread_id = Column(String(256), nullable=True)
    subject = Column(String(512), nullable=True)
    body = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, server_default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    source_message_id = Column(String(256), nullable=True)
    description = Column(Text, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    action_required = Column(String(64), nullable=True)
    completed = Column(Integer, nullable=False, server_default="0")
    important = Column(Integer, nullable=False, server_default="0")
    notes = Column(Text, nullable=True)
    meta = Column("metadata", Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    draft_id = Column(Integer, ForeignKey("drafts.id"), nullable=True)
    event_id = Column(String(256), nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, server_default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


class MeetingBrief(Base):
    __tablename__ = "meeting_briefs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(String(256), nullable=False)
    brief = Column(Text, nullable=False)
    structured = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



