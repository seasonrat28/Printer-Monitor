import asyncio
import sys
from pysnmp.hlapi.asyncio import *

async def find_supplies(ip):
    engine = SnmpEngine()
    print(f"--- Scanning entire SNMP tree on {ip} for Fuser/Laser/PF Kit ---")
    print("This will take a few minutes. Please wait until 'DONE' appears.")
    
    current_oid = ObjectType(ObjectIdentity('1.3.6.1'))
    keywords = ["fuser", "laser", "pf kit", "drum", "toner", "126127", "158341", "17752"]
    
    count = 0
    with open("found_supplies2.txt", "w", encoding="utf-8") as f:
        while True:
            try:
                errorIndication, errorStatus, errorIndex, varBinds = await next_cmd(
                    engine,
                    CommunityData('public', mpModel=1),
                    await UdpTransportTarget.create((ip, 161), timeout=2.0, retries=1),
                    ContextData(),
                    current_oid
                )
                if errorIndication or errorStatus or not varBinds:
                    print(f"\nStopped or finished: {errorIndication or errorStatus or 'End of MIB'}")
                    break
                    
                vb = varBinds[0]
                oid_str = str(vb[0])
                val_str = str(vb[1])
                val_lower = val_str.lower()
                
                count += 1
                if count % 100 == 0:
                    print(f"\rScanned {count} items... (Current: {oid_str})", end="")
                
                # Check if value matches our keywords
                if any(k in val_lower for k in keywords):
                    msg = f"\nFOUND: {oid_str} = {val_str}"
                    print(msg)
                    f.write(msg + "\n")
                    f.flush()
                    
                current_oid = ObjectType(ObjectIdentity(oid_str))
            except Exception as e:
                try:
                    current_oid = ObjectType(ObjectIdentity(oid_str))
                except:
                    break
    print(f"\nDONE! Total items scanned: {count}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python find_supplies.py <ip>")
        sys.exit(1)
    asyncio.run(find_supplies(sys.argv[1]))