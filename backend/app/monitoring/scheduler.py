from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.monitoring.tasks import ping_printers, sync_all_printers

scheduler = AsyncIOScheduler()

def start_scheduler():
    scheduler.add_job(ping_printers, 'interval', seconds=settings.STATUS_INTERVAL)
    scheduler.add_job(sync_all_printers, 'interval', seconds=settings.SUPPLY_INTERVAL)
    
    if settings.DEMO_MODE:
        from app.monitoring.tasks import simulate_demo_printers
        scheduler.add_job(simulate_demo_printers, 'interval', seconds=30)
        
    scheduler.start()
