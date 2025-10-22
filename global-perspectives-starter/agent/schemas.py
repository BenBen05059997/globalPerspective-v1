
from pydantic import BaseModel
from typing import Optional

class Plan(BaseModel):
    topic: str
    is_conflict: bool = False
    language: Optional[str] = "en"
