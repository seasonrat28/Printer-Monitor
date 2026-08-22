"""
Reverse Proxy Server - โคลน 100% จาก IT Support PLK (10.119.43.37:5001)
ดึงทุก API และหน้าเว็บจาก IT server โดยตรง ไม่มีการจำลองเอง
"""

import httpx
import os
from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

# ============================================================
#  ตั้งค่า: เปลี่ยน IT_SERVER ถ้า IP ของ IT เปลี่ยน
# ============================================================
IT_SERVER = "http://10.119.43.37:5001"
PORT = 3000

app = FastAPI(title="Printer Monitor Proxy", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTP client สำหรับ proxy ไปยัง IT server
client = httpx.AsyncClient(base_url=IT_SERVER, timeout=60.0)


async def proxy_request(request: Request, path: str) -> Response:
    """ส่ง request ต่อไปยัง IT server แบบ 1:1"""
    # รวบรวม headers (ยกเว้น host)
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length")
    }

    # อ่าน body
    body = await request.body()

    # Query string
    query = str(request.url.query)
    url = f"/{path}" + (f"?{query}" if query else "")

    # ส่งต่อ
    resp = await client.request(
        method=request.method,
        url=url,
        headers=headers,
        content=body,
    )

    # คืนผลลัพธ์กลับมาตรงๆ
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers),
        media_type=resp.headers.get("content-type"),
    )


# ============================================================
#  Routes — proxy ทุก path ไปยัง IT server
# ============================================================

@app.get("/")
@app.head("/")
async def root(request: Request):
    return await proxy_request(request, "")


@app.get("/setting")
@app.get("/settings")
async def setting_page(request: Request):
    return await proxy_request(request, "setting")


@app.api_route("/static/{path:path}", methods=["GET", "HEAD"])
async def static_files(request: Request, path: str):
    return await proxy_request(request, f"static/{path}")


@app.api_route("/check_single", methods=["POST"])
async def check_single(request: Request):
    return await proxy_request(request, "check_single")


@app.api_route("/check_range", methods=["POST"])
async def check_range(request: Request):
    return await proxy_request(request, "check_range")


@app.api_route("/check_printer_db", methods=["POST"])
async def check_printer_db(request: Request):
    return await proxy_request(request, "check_printer_db")


@app.api_route("/api/iplist", methods=["GET", "POST", "DELETE"])
async def api_iplist(request: Request):
    return await proxy_request(request, "api/iplist")


@app.api_route("/api/iplist/clear", methods=["POST"])
async def api_iplist_clear(request: Request):
    return await proxy_request(request, "api/iplist/clear")


@app.api_route("/api/logs", methods=["GET", "POST", "DELETE"])
async def api_logs(request: Request):
    return await proxy_request(request, "api/logs")


@app.api_route("/api/settings", methods=["GET", "POST"])
async def api_settings(request: Request):
    return await proxy_request(request, "api/settings")


@app.api_route("/api/favorites", methods=["GET", "POST", "DELETE"])
async def api_favorites(request: Request):
    return await proxy_request(request, "api/favorites")


@app.api_route("/api/favorites/clear", methods=["POST"])
async def api_favorites_clear(request: Request):
    return await proxy_request(request, "api/favorites/clear")


# Catch-all: proxy ทุก path ที่ไม่ match ข้างบน
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"])
async def catch_all(request: Request, path: str):
    return await proxy_request(request, path)


# ============================================================
#  Entry point
# ============================================================
if __name__ == "__main__":
    import uvicorn
    import webbrowser
    import threading

    def open_browser():
        import time
        time.sleep(1.5)
        webbrowser.open(f"http://localhost:{PORT}")

    print("=" * 60)
    print(f"  Printer Monitor Proxy Server")
    print(f"  Proxying: http://localhost:{PORT}  ->  {IT_SERVER}")
    print("=" * 60)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=PORT)
