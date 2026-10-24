from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from jose import JWTError, jwt

from app.db.session import get_db
from app.models.user import User as UserModel
from app.schemas.token import Token
from app.schemas.user import UserResponse
from app.core import security
from app.core.config import settings

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login/access-token")

from fastapi import Request
import socket

def parse_user_agent(ua_str: str):
    ua = ua_str.lower()
    # Device type
    if "mobile" in ua or "android" in ua and "mobile" in ua or "iphone" in ua:
        device_type = "Mobile"
    elif "ipad" in ua or "tablet" in ua:
        device_type = "Tablet"
    else:
        device_type = "Desktop"

    # OS
    if "windows nt 10.0" in ua or "windows nt 11.0" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os x" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Unknown OS"

    # Browser
    if "edg/" in ua:
        browser_name = "Microsoft Edge"
    elif "chrome/" in ua:
        browser_name = "Google Chrome"
    elif "firefox/" in ua:
        browser_name = "Mozilla Firefox"
    elif "safari/" in ua:
        browser_name = "Apple Safari"
    else:
        browser_name = "Web Browser"

    return device_type, os_name, browser_name

def resolve_hostname(ip: str) -> str:
    if not ip or ip in ("127.0.0.1", "::1"):
        try:
            return socket.gethostname()
        except:
            return "Localhost"
    try:
        host, _, _ = socket.gethostbyaddr(ip)
        return host
    except:
        return ""

@router.post("/login/access-token", response_model=Token)
def login_access_token(
    request: Request,
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
):
    from app.models.audit import LoginLog

    # Extract Client IP
    client_ip = request.headers.get("CF-Connecting-IP") or \
                request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or \
                (request.client.host if request.client else "Unknown")

    user_agent = request.headers.get("User-Agent", "")
    device_type, os_name, browser_name = parse_user_agent(user_agent)
    client_hostname = resolve_hostname(client_ip)

    user = db.query(UserModel).filter(func.lower(UserModel.username) == func.lower(form_data.username)).first()
    
    if not user or not security.verify_password(form_data.password, user.password_hash):
        # Record Failed Login
        try:
            db.add(LoginLog(
                username=form_data.username,
                ip_address=client_ip,
                hostname=client_hostname,
                user_agent=user_agent[:250] if user_agent else None,
                device_type=device_type,
                os_name=os_name,
                browser_name=browser_name,
                status="FAILED",
                fail_reason="Invalid credentials"
            ))
            db.commit()
        except Exception as e:
            db.rollback()
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    elif not user.is_active:
        try:
            db.add(LoginLog(
                username=user.username,
                user_id=user.id,
                display_name=user.display_name,
                role=user.role,
                ip_address=client_ip,
                hostname=client_hostname,
                user_agent=user_agent[:250] if user_agent else None,
                device_type=device_type,
                os_name=os_name,
                browser_name=browser_name,
                status="FAILED",
                fail_reason="User is inactive"
            ))
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Record Successful Login
    try:
        new_log = LoginLog(
            username=user.username,
            user_id=user.id,
            display_name=user.display_name,
            role=user.role,
            ip_address=client_ip,
            hostname=client_hostname,
            user_agent=user_agent[:250] if user_agent else None,
            device_type=device_type,
            os_name=os_name,
            browser_name=browser_name,
            status="SUCCESS"
        )
        db.add(new_log)
        db.commit()
    except Exception as e:
        db.rollback()
        import traceback
        print(f"Error saving login log: {e}\n{traceback.format_exc()}", flush=True)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
        "role": user.role,
        "display_name": user.display_name
    }

@router.post("/refresh", response_model=Token)
def refresh_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Silently renew a valid (non-expired) token without re-login."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(UserModel).filter(UserModel.id == int(user_id)).first()
    if not user or not user.is_active:
        raise credentials_exception

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
        "role": user.role,
        "display_name": user.display_name
    }
