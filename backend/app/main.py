from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Enterprise Printer Monitoring API",
    description="Backend API for managing and monitoring network printers",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Enterprise Printer Monitor API is running"}

@app.get("/test_dashboard")
def test_dashboard():
    from app.db.session import SessionLocal
    from app.api.endpoints.printers import get_dashboard_summary
    import traceback
    db = SessionLocal()
    try:
        res = get_dashboard_summary(db)
        return {"status": "ok", "res": res}
    except Exception as e:
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}
    finally:
        db.close()

@app.get("/scrape_printer2/{ip}")
def scrape_printer2(ip: str):
    import urllib.request
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        url = f"https://{ip}/home/status.html"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            html = response.read().decode('utf-8')
            return {"status": "ok", "raw_html": f"```html\n{html}\n```"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/snmp_walk")
async def snmp_walk(ip: str = "10.119.34.20", community: str = "public"):
    """Walk SNMP supply OIDs and return raw descriptions + levels - for debugging."""
    try:
        from app.snmp.standard import StandardSNMPAdapter
        adapter = StandardSNMPAdapter(ip=ip, community=community, version="v2c", timeout=5)
        descriptions = await adapter._walk_oid("1.3.6.1.2.1.43.11.1.1.6")
        max_caps     = await adapter._walk_oid("1.3.6.1.2.1.43.11.1.1.8")
        levels       = await adapter._walk_oid("1.3.6.1.2.1.43.11.1.1.9")
        sys_descr    = await adapter._get_oid("1.3.6.1.2.1.1.1.0")
        
        result = []
        for idx, desc in descriptions.items():
            lvl = levels.get(idx, "?")
            mx  = max_caps.get(idx, "?")
            pct = None
            try:
                if int(mx) > 0:
                    pct = round(int(lvl) / int(mx) * 100)
            except:
                pass
            result.append({"idx": idx, "desc": desc, "level": lvl, "max": mx, "pct": pct})
        
        return {"sys_descr": sys_descr, "supplies": result}
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "trace": traceback.format_exc()}

@app.get("/apeos_login_debug")
async def apeos_login_debug(ip: str = "10.119.34.20", pwd: str = "Admin@5218"):
    """Debug Apeos login: show input fields on login page + try to get AuthCookie."""
    import httpx, re, urllib.parse
    result = {}
    try:
        async with httpx.AsyncClient(verify=False, timeout=8, follow_redirects=True) as client:
            # Step 1: GET login page
            resp1 = await client.get(f"https://{ip}/home/status.html",
                                     headers={"User-Agent": "Mozilla/5.0"})
            html  = resp1.content.decode("iso-8859-1", errors="replace")
            result["get_status"] = resp1.status_code
            result["cookies_after_get"] = dict(resp1.cookies)

            # Find all input fields
            inputs = re.findall(r'<input\s+([^>]+)>', html, re.IGNORECASE)
            result["inputs"] = inputs[:20]

            # Find password field
            pwd_match = re.search(r'<input\s+[^>]*type=["\']?password["\']?[^>]*name=["\']?([^"\'>\s]+)', html, re.IGNORECASE)
            if not pwd_match:
                pwd_match = re.search(r'<input\s+[^>]*name=["\']?([^"\'>\s]+)[^>]*type=["\']?password', html, re.IGNORECASE)
            pwd_field = pwd_match.group(1) if pwd_match else "B1859"
            result["detected_pwd_field"] = pwd_field

            # Find CSRF
            csrf_match = re.search(r'name=["\']?CSRFToken["\']?\s+value=["\']?([^"\'>\s]+)', html, re.IGNORECASE)
            if not csrf_match:
                csrf_match = re.search(r'<input[^>]*name=["\']CSRFToken["\'][^>]*value=["\']([^"\']+)', html, re.IGNORECASE)
            csrf = csrf_match.group(1) if csrf_match else None
            result["csrf_found"] = bool(csrf)

            # Step 2: POST login
            data = {pwd_field: pwd, "loginurl": "/general/information.html?kind=item"}
            if csrf:
                data["CSRFToken"] = csrf
            body = urllib.parse.urlencode(data)
            resp2 = await client.post(f"https://{ip}/home/status.html",
                                      content=body.encode(),
                                      headers={"Content-Type": "application/x-www-form-urlencoded",
                                               "User-Agent": "Mozilla/5.0"})
            result["post_status"] = resp2.status_code
            result["cookies_after_post"] = dict(resp2.cookies)
            result["auth_cookie"] = resp2.cookies.get("AuthCookie")

            # Step 3: If we got a cookie, fetch the info page
            if result["auth_cookie"]:
                resp3 = await client.get(f"https://{ip}/general/information.html?kind=item",
                                         headers={"User-Agent": "Mozilla/5.0",
                                                  "Cookie": f"AuthCookie={result['auth_cookie']}"})
                info_html = resp3.content.decode("iso-8859-1", errors="replace")
                result["info_page_status"] = resp3.status_code
                # Quick check for Fuser
                result["fuser_in_html"] = "Fuser" in info_html
                result["html_snippet"] = info_html[2000:3500] if len(info_html) > 2000 else info_html
    except Exception as e:
        import traceback
        result["error"] = str(e)
        result["trace"] = traceback.format_exc()
    return result


@app.get("/test_apeos_creds")
def get_creds():
    from app.database import SessionLocal
    from app.models.printer import Printer
    db = SessionLocal()
    printers = db.query(Printer).all()
    creds = [{"ip": p.ip_address, "pwd": p.snmp_community, "model": p.model, "type": p.scraper_type} for p in printers]
    return creds

@app.get("/test_apeos3")
async def test_apeos3(ip: str = "10.119.34.20", pwd: str = "111111"):
    from app.scrapers.apeos import ApeosHTTPScraper
    from fastapi.responses import HTMLResponse
    scraper = ApeosHTTPScraper(ip, password=pwd)
    html = await scraper._fetch_info_page()
    if html:
        return HTMLResponse(content=html)
    return {"status": "error", "msg": f"failed to fetch with password {pwd}"}

@app.get("/debug_snmp/{ip}")
async def debug_snmp(ip: str):
    from pysnmp.hlapi.asyncio import SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity, next_cmd, get_cmd
    
    engine = SnmpEngine()
    results = {"standard_desc": {}, "brother_hex": None}
    
    try:
        # Standard descriptions
        async for errorIndication, errorStatus, errorIndex, varBinds in next_cmd(
            engine,
            CommunityData('public', mpModel=1),
            await UdpTransportTarget.create((ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.2.1.43.11.1.1.6')),
            lexicographicMode=False
        ):
            if not errorIndication and not errorStatus:
                for vb in varBinds:
                    results["standard_desc"][str(vb[0])] = str(vb[1])
                    
        # Max Capacities
        results["max_caps"] = {}
        async for errorIndication, errorStatus, errorIndex, varBinds in next_cmd(
            engine, CommunityData('public', mpModel=1), await UdpTransportTarget.create((ip, 161)), ContextData(), ObjectType(ObjectIdentity('1.3.6.1.2.1.43.11.1.1.8')), lexicographicMode=False
        ):
            if not errorIndication and not errorStatus:
                for vb in varBinds: results["max_caps"][str(vb[0])] = str(vb[1])
                
        # Levels
        results["levels"] = {}
        async for errorIndication, errorStatus, errorIndex, varBinds in next_cmd(
            engine, CommunityData('public', mpModel=1), await UdpTransportTarget.create((ip, 161)), ContextData(), ObjectType(ObjectIdentity('1.3.6.1.2.1.43.11.1.1.9')), lexicographicMode=False
        ):
            if not errorIndication and not errorStatus:
                for vb in varBinds: results["levels"][str(vb[0])] = str(vb[1])

        # System Description
        errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
            engine, CommunityData('public', mpModel=1), await UdpTransportTarget.create((ip, 161)), ContextData(), ObjectType(ObjectIdentity('1.3.6.1.2.1.1.1.0'))
        )
        if not errorIndication and not errorStatus:
            results["sysDescr"] = str(varBinds[0][1])

    except Exception as e:
        results["error"] = str(e)
        
    return results

from app.api.api import api_router
from app.db.session import engine, SessionLocal
from app.models.base import Base
from app.models.user import User
from app.models.printer import Printer
from app.models.monitoring import PrinterStatusHistory, PrinterSupplies, PrinterCounters, PrinterSuppliesSnapshot
from app.models.alert import Alert
from app.models.group import PrinterGroup
from app.models.audit import AuditLog
from app.models.settings import SystemSetting, BlacklistIP
from app.models.floormap import FloorMap, PrinterPin
from app.monitoring.scheduler import start_scheduler
from app.db.init_db import init_db

# Create tables for dev
Base.metadata.create_all(bind=engine)

@app.on_event("startup")
async def startup_event():
    # Initialize DB with default user
    db = SessionLocal()
    try:
        from sqlalchemy import text
        
        # Migration: is_favorite column
        try:
            db.execute(text("ALTER TABLE printers ADD COLUMN is_favorite BOOLEAN DEFAULT 0"))
            db.commit()
            logger.info("Added is_favorite column to printers table")
        except Exception:
            db.rollback()

        # Migration: new Apeos parts
        for col in ["fuser_level", "laser_unit_level", "pf_kit_mp_level", "pf_kit_1_level"]:
            try:
                db.execute(text(f"ALTER TABLE printers ADD COLUMN {col} INTEGER"))
                db.commit()
                logger.info(f"Added {col} column to printers table")
            except Exception:
                db.rollback()


        # Migration: scraper_type column
        try:
            db.execute(text("ALTER TABLE printers ADD COLUMN scraper_type VARCHAR DEFAULT 'snmp'"))
            db.commit()
            logger.info("Added scraper_type column to printers table")
        except Exception:
            db.rollback()

        # Migration: page_count column
        try:
            db.execute(text("ALTER TABLE printers ADD COLUMN page_count INTEGER DEFAULT 0"))
            db.commit()
            logger.info("Added page_count column to printers table")
        except Exception:
            db.rollback()

        # Auto-detect existing Apeos printers → mark as http_apeos
        try:
            APEOS_KEYWORDS = ("apeos", "fujifilm", "fuji xerox", "fuji-xerox")
            result = db.execute(text("SELECT id, model, manufacturer FROM printers")).fetchall()
            updated = 0
            for row in result:
                pid, model, manufacturer = row[0], (row[1] or "").lower(), (row[2] or "").lower()
                is_apeos = any(kw in model or kw in manufacturer for kw in APEOS_KEYWORDS)
                if is_apeos:
                    db.execute(text(f"UPDATE printers SET scraper_type='http_apeos' WHERE id={pid}"))
                    updated += 1
            if updated:
                db.commit()
                logger.info(f"Auto-detected {updated} Apeos printer(s) → set to HTTP scraper")
        except Exception as e:
            db.rollback()
            logger.warning(f"Apeos auto-detect failed: {e}")
            
        init_db(db)
    finally:
        db.close()

    start_scheduler()
    
    # Run initial supply check immediately via scheduler so it doesn't get garbage collected
    from app.monitoring.scheduler import scheduler
    from app.monitoring.tasks import check_snmp_supplies
    import datetime
    scheduler.add_job(check_snmp_supplies, 'date', run_date=datetime.datetime.now())

from fastapi.staticfiles import StaticFiles
import os

os.makedirs("uploads/floormaps", exist_ok=True)
app.mount("/static/floormaps", StaticFiles(directory="uploads/floormaps"), name="floormaps")

app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
