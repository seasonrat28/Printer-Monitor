from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.discovery.scanner import scan_network

router = APIRouter()

class ScanRequest(BaseModel):
    cidr: str
    snmp_community: str = "public"
    snmp_version: str = "v2c"

from app.db.session import get_db
from sqlalchemy.orm import Session
from fastapi import Depends
from app.models.settings import BlacklistIP

@router.post("/scan", response_model=List[Dict[str, Any]])
async def start_discovery_scan(scan_req: ScanRequest, db: Session = Depends(get_db)):
    try:
        blacklist = [b.ip_address for b in db.query(BlacklistIP).all()]
        results = await scan_network(
            cidr=scan_req.cidr,
            snmp_community=scan_req.snmp_community,
            snmp_version=scan_req.snmp_version,
            blacklist=blacklist
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An error occurred during discovery scan")
