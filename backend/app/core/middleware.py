from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import time

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 200, window: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window
        self.request_records = {} # Format: { ip: [timestamp1, timestamp2, ...] }

    async def dispatch(self, request: Request, call_next):
        # Exclude static files and frontend proxy if needed
        if request.url.path.startswith("/static") or request.url.path.startswith("/ws"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        
        now = time.time()
        
        # Clean up old requests
        if client_ip in self.request_records:
            self.request_records[client_ip] = [
                t for t in self.request_records[client_ip] 
                if now - t < self.window
            ]
        else:
            self.request_records[client_ip] = []
            
        # Check rate limit
        if len(self.request_records[client_ip]) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."}
            )
            
        # Record request
        self.request_records[client_ip].append(now)
        
        response = await call_next(request)
        return response
