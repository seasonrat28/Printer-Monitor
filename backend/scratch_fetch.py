import asyncio
from app.scrapers.apeos import ApeosHTTPScraper

async def main():
    scraper = ApeosHTTPScraper("10.119.34.20", password="111")
    html = await scraper._fetch_info_page()
    if html:
        with open("apeos_info.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("Saved to apeos_info.html")
        
        import re
        supplies = {
            "toner_level": None,
            "drum_level": None,
            "fuser_level": None,
            "laser_unit_level": None,
            "pf_kit_mp_level": None,
            "pf_kit_1_level": None
        }

        # Toner: <dt>Toner**</dt><dd>90%</dd>
        m = re.search(r'<dt>Toner\*+</dt><dd>(\d+)%</dd>', html)
        if m:
            supplies["toner_level"] = int(m.group(1))

        # Drum Unit: <dt>Drum Unit*</dt><dd>97%</dd>
        m = re.search(r'<dt>Drum\s*(?:&#32;)?Unit\*+</dt><dd>(\d+)%</dd>', html, re.IGNORECASE)
        if m:
            supplies["drum_level"] = int(m.group(1))

        # Fuser
        m = re.search(r'<dt>Fuser\*+</dt><dd>(\d+)%</dd>', html, re.IGNORECASE)
        if not m:
            m = re.search(r'<dt>[^<]*Fuser[^<]*</dt>\s*<dd>(\d+)%</dd>', html, re.IGNORECASE)
        if m:
            supplies["fuser_level"] = int(m.group(1))

        # Laser Unit
        m = re.search(r'<dt>[^<]*Laser\s*(?:&#32;)?Unit[^<]*</dt>\s*<dd>(\d+)%</dd>', html, re.IGNORECASE)
        if m:
            supplies["laser_unit_level"] = int(m.group(1))

        # PF Kit MP
        m = re.search(r'<dt>[^<]*PF\s*(?:&#32;)?Kit\s*(?:&#32;)?MP[^<]*</dt>\s*<dd>(\d+)%</dd>', html, re.IGNORECASE)
        if m:
            supplies["pf_kit_mp_level"] = int(m.group(1))

        # PF Kit 1
        m = re.search(r'<dt>[^<]*PF\s*(?:&#32;)?Kit\s*(?:&#32;)?1[^<]*</dt>\s*<dd>(\d+)%</dd>', html, re.IGNORECASE)
        if m:
            supplies["pf_kit_1_level"] = int(m.group(1))
            
        print("Supplies found:", supplies)
    else:
        print("Failed to fetch")

if __name__ == "__main__":
    asyncio.run(main())
