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
    ip_address = Column(String, nullable=True)
    status = Column(String, default="SUCCESS") # SUCCESS, FAILED
    old_value = Column(String, nullable=True) # JSON string
    new_value = Column(String, nullable=True) # JSON string
    details = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class LoginLog(Base):
    __tablename__ = "login_logs"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    user_id = Column(Integer, nullable=True)
    display_name = Column(String, nullable=True)
    role = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    hostname = Column(String, nullable=True)      # Computer / Device name
    user_agent = Column(String, nullable=True)    # Browser / OS
    device_type = Column(String, nullable=True)   # Desktop / Mobile / Tablet
    os_name = Column(String, nullable=True)       # Windows / Android / iOS / macOS
    browser_name = Column(String, nullable=True)  # Chrome / Edge / Safari
    status = Column(String, default="SUCCESS")     # SUCCESS, FAILED
    fail_reason = Column(String, nullable=True)
    login_at = Column(DateTime, default=datetime.utcnow)

