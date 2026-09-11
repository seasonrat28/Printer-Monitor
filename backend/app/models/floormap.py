from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base

class FloorMap(Base):
    __tablename__ = "floor_maps"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    image_url = Column(String, nullable=False)  # Path to the uploaded map image
    width = Column(Float, nullable=True)  # Native width of image for scaling
    height = Column(Float, nullable=True) # Native height of image for scaling
    is_active = Column(Boolean, default=True)
    
    pins = relationship("PrinterPin", back_populates="floor_map", cascade="all, delete-orphan")

class PrinterPin(Base):
    __tablename__ = "printer_pins"
    
    id = Column(Integer, primary_key=True, index=True)
    floor_map_id = Column(Integer, ForeignKey("floor_maps.id", ondelete="CASCADE"), nullable=False)
    printer_id = Column(Integer, ForeignKey("printers.id", ondelete="CASCADE"), nullable=False)
    x_percent = Column(Float, nullable=False)  # Store as percentage for responsive scaling
    y_percent = Column(Float, nullable=False)
    
    floor_map = relationship("FloorMap", back_populates="pins")
    # printer relation is not strictly needed here for basic fetch, but we can query by printer_id
