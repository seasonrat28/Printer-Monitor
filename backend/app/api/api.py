from fastapi import APIRouter
from app.api.endpoints import printers, auth, discovery, ws

api_router = APIRouter()
api_router.include_router(printers.router, prefix="/printers", tags=["printers"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(discovery.router, prefix="/discovery", tags=["discovery"])
api_router.include_router(ws.router, prefix="/ws", tags=["websocket"])
