from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.discovery.scanner import scan_network

router = APIRouter()

class ScanRequest(BaseModel):
    cidr: str
    snmp_community: str = "public"
    snmp_version: str = "v2c"

@router.post("/scan", response_model=List[Dict[str, Any]])
async def start_discovery_scan(scan_req: ScanRequest):
    try:
        results = await scan_network(
            cidr=scan_req.cidr,
            snmp_community=scan_req.snmp_community,
            snmp_version=scan_req.snmp_version
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An error occurred during discovery scan")
