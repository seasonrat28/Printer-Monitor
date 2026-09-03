from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.monitoring.tasks import ping_printers, check_snmp_status, check_snmp_supplies

scheduler = AsyncIOScheduler()

def start_scheduler():
    scheduler.add_job(ping_printers, 'interval', seconds=settings.STATUS_INTERVAL)
    scheduler.add_job(check_snmp_status, 'interval', seconds=settings.STATUS_INTERVAL * 2)
    scheduler.add_job(check_snmp_supplies, 'interval', seconds=settings.SUPPLY_INTERVAL)
    
    if settings.DEMO_MODE:
        from app.monitoring.tasks import simulate_demo_printers
        scheduler.add_job(simulate_demo_printers, 'interval', seconds=30)
        
    scheduler.start()
