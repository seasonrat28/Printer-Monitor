import os
from fastapi import APIRouter, HTTPException

router = APIRouter()

LOG_FILE_PATH = r"D:\app\Printer-Monitor\logs\backend.log"

@router.get("/")
def get_system_logs(lines: int = 100):
    if not os.path.exists(LOG_FILE_PATH):
        return {"logs": ["Log file not found."]}
    
    try:
        with open(LOG_FILE_PATH, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()
            # Return last N lines
            return {"logs": all_lines[-lines:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
