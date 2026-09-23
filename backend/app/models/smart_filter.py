from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import Base

# Association table for many-to-many relationship
printer_smart_filter_association = Table(
    'printer_smart_filter_association',
    Base.metadata,
    Column('printer_id', Integer, ForeignKey('printers.id')),
    Column('smart_filter_id', Integer, ForeignKey('smart_filters.id'))
)

class SmartFilter(Base):
    __tablename__ = "smart_filters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    printers = relationship("Printer", secondary=printer_smart_filter_association, backref="smart_filters")
