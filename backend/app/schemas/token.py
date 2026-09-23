from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str = None
    display_name: str = None

class TokenPayload(BaseModel):
    sub: str = None
