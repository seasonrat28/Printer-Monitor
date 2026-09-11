from sqlalchemy import Column, Integer, String
from app.models.base import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)

class BlacklistIP(Base):
    __tablename__ = "blacklist_ips"
    
    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(String, nullable=True) # use string for simplicity or DateTime
