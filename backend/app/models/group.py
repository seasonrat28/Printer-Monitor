from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import Base

# Association table for many-to-many relationship
printer_group_association = Table(
    'printer_group_association',
    Base.metadata,
    Column('printer_id', Integer, ForeignKey('printers.id')),
    Column('group_id', Integer, ForeignKey('printer_groups.id'))
)

class PrinterGroup(Base):
    __tablename__ = "printer_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    printers = relationship("Printer", secondary=printer_group_association, backref="groups")
