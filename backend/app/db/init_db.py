from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings

def init_db(db: Session) -> None:
    # Check if admin user exists
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin_user = User(
            username="admin",
            password_hash=get_password_hash("admin"),
            display_name="System Administrator",
            role="ADMIN",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
