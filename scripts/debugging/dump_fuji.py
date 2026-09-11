import asyncio
import sys
from pysnmp.hlapi.asyncio import *

async def walk_oid(ip, oid):
    engine = SnmpEngine()
    print(f"--- Walking OID: {oid} on {ip} ---")
    results = {}
    current_oid = ObjectType(ObjectIdentity(oid))
    while True:
        try:
            errorIndication, errorStatus, errorIndex, varBinds = await next_cmd(
                engine,
                CommunityData('public', mpModel=1),
                await UdpTransportTarget.create((ip, 161)),
                ContextData(),
                current_oid
            )
            if errorIndication or errorStatus or not varBinds:
                if errorIndication or errorStatus:
                    print(f"Error: {errorIndication or errorStatus}")
                break
                
            vb = varBinds[0]
            oid_str = str(vb[0])
            if not oid_str.startswith(oid):
                break
                
            val = str(vb[1])
            print(f"{vb[0]} = {val}")
            results[oid_str] = val
            current_oid = ObjectType(ObjectIdentity(oid_str))
        except Exception as e:
            # ignore print errors
            try:
                current_oid = ObjectType(ObjectIdentity(oid_str))
            except:
                break
    return results

async def main():
    if len(sys.argv) < 2:
        print("Usage: python dump_fuji.py <ip>")
        return
        
    ip = sys.argv[1]
    
    # FujiXerox / FujiFilm Enterprise OIDs
    oids_to_walk = [
        "1.3.6.1.4.1.253",  # FujiXerox
        "1.3.6.1.4.1.297",  # Xerox
        "1.3.6.1.4.1.388",  # FujiXerox (alternate)
    ]
    
    for oid in oids_to_walk:
        await walk_oid(ip, oid)

if __name__ == "__main__":
    asyncio.run(main())
