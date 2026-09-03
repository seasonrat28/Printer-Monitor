from pydantic import BaseModel
from typing import Dict, Optional

class SettingsUpdate(BaseModel):
    settings: Dict[str, str]

class SettingsResponse(BaseModel):
    settings: Dict[str, str]
