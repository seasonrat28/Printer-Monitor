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
                
            print(f"{vb[0]} = {vb[1]}")
            results[oid_str] = vb[1]
            current_oid = ObjectType(ObjectIdentity(oid_str))
        except Exception as e:
            print(f"Exception: {e}")
            break
    return results

async def main():
    if len(sys.argv) < 2:
        print("Usage: python dump_brother.py <printer_ip>")
        sys.exit(1)
        
    ip = sys.argv[1]
    # Standard Printer MIB Supplies Table
    await walk_oid(ip, "1.3.6.1.2.1.43.11.1.1")
    
    # Brother Private MIB for Toner Status (brTonerLow etc)
    await walk_oid(ip, "1.3.6.1.4.1.2435.2.3.9.1.1.2.10")
    
    # Brother Private MIB for Maintenance Info (OctetString containing percentages)
    await walk_oid(ip, "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5")

if __name__ == "__main__":
    asyncio.run(main())
