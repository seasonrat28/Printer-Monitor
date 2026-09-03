from fastapi import APIRouter, Depends
from app.api.endpoints import printers, auth, discovery, ws, reports, groups, users, settings
from app.api.deps import get_current_active_user

api_router = APIRouter()
api_router.include_router(printers.router, prefix="/printers", tags=["printers"], dependencies=[Depends(get_current_active_user)])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(discovery.router, prefix="/discovery", tags=["discovery"], dependencies=[Depends(get_current_active_user)])
api_router.include_router(ws.router, prefix="/ws", tags=["websocket"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"], dependencies=[Depends(get_current_active_user)])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"], dependencies=[Depends(get_current_active_user)])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
