from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.monitoring.tasks import ping_printers, sync_all_printers

scheduler = AsyncIOScheduler()

def start_scheduler():
    scheduler.add_job(
        ping_printers,
        'interval',
        seconds=settings.STATUS_INTERVAL,
        id='printer_status_poll',
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )
    scheduler.add_job(
        sync_all_printers,
        'interval',
        seconds=settings.SUPPLY_INTERVAL,
        id='printer_supply_sync',
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
    )
    
    from app.monitoring.tasks import cleanup_old_logs
    scheduler.add_job(
        cleanup_old_logs,
        'interval',
        days=1,
        id='cleanup_old_logs',
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    
    if settings.DEMO_MODE:
        from app.monitoring.tasks import simulate_demo_printers
        scheduler.add_job(simulate_demo_printers, 'interval', seconds=30)
        
    scheduler.start()
