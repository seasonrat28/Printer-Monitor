import logging
import sys
import os
from logging.handlers import TimedRotatingFileHandler

def setup_logger(name: str = "app"):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Don't add handlers if they already exist
    if not logger.handlers:
        log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../logs"))
        os.makedirs(log_dir, exist_ok=True)
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_format = logging.Formatter("%(asctime)s - [%(levelname)s] - %(message)s", datefmt='%Y-%m-%d %H:%M:%S')
        console_handler.setFormatter(console_format)
        
        # File handler (rotates daily, keeps 14 days)
        file_handler = TimedRotatingFileHandler(
            filename=os.path.join(log_dir, "printer_system.log"),
            when="midnight",
            interval=1,
            backupCount=14,
            encoding="utf-8"
        )
        file_format = logging.Formatter("%(asctime)s - [%(levelname)s] - %(message)s", datefmt='%Y-%m-%d %H:%M:%S')
        file_handler.setFormatter(file_format)
        
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)
        
    return logger

logger = setup_logger()

def log_printer_event(printer_ip: str, status: str, details: str):
    """
    ฟังก์ชันสำหรับบันทึก Log ลงไฟล์ ยูสเซอร์หรือแอดมินสามารถมาเปิดดูประวัติย้อนหลังได้
    """
    log_message = f"Printer IP: {printer_ip} | Status: {status} | Details: {details}"
    
    if status.upper() in ["CRITICAL", "ERROR", "WARNING"]:
        logger.warning(log_message)
    else:
        logger.info(log_message)
