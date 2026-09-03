from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Enterprise Printer Monitor"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite:///./printer_monitor.db"
    
    # JWT Auth
    SECRET_KEY: str = "supersecretkey-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Monitoring Intervals (Seconds)
    STATUS_INTERVAL: int = 30
    SUPPLY_INTERVAL: int = 300
    COUNTER_INTERVAL: int = 600
    
    # SNMP
    SNMP_TIMEOUT: int = 2
    SNMP_RETRIES: int = 1
    
    # Demo Mode
    DEMO_MODE: bool = False
    
    # Notifications
    LINE_NOTIFY_TOKEN: str = ""
    TEAMS_WEBHOOK_URL: str = ""
    SMTP_SERVER: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_TO_EMAIL: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
