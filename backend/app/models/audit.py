from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.models.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, index=True)  # e.g., 'CREATE_PRINTER', 'DELETE_PRINTER'
    entity_type = Column(String)         # e.g., 'Printer', 'Group'
    entity_id = Column(Integer, nullable=True)
    user_id = Column(Integer, nullable=True)
    details = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
