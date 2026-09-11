"""
Quick test: ApeosHTTPScraper against 10.119.34.21
"""
import asyncio
import sys
sys.path.insert(0, '.')

from app.scrapers.apeos import ApeosHTTPScraper

IP = "10.119.34.21"
PASSWORD = "Admin@5218"

async def main():
    scraper = ApeosHTTPScraper(ip=IP, password=PASSWORD, timeout=10)
    
    print("=== get_status() ===")
    status, msg = await scraper.get_status()
    print(f"  Status: {status}, Message: {msg}")
    print()
    
    print("=== get_system_info() ===")
    info = await scraper.get_system_info()
    for k, v in info.items():
        print(f"  {k}: {v}")
    print()
    
    print("=== get_supplies() ===")
    supplies = await scraper.get_supplies()
    print(f"  Toner: {supplies['toner_level']}%")
    print(f"  Drum:  {supplies['drum_level']}%")
    print()
    
    print("=== get_counters() ===")
    counters = await scraper.get_counters()
    print(f"  Total Pages: {counters['total_pages']}")
    
    scraper.close()

asyncio.run(main())
