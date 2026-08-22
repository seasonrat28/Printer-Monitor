"""FUJIFILM Apeos 4620 SZ Adapter.
Encapsulates all FUJIFILM / Fuji Xerox specific identification, OIDs, and parsing logic.
"""

import re
from typing import Any, Dict, Optional
from services.snmp import SNMPService

# Apeos 4620 SZ and Fuji Xerox OID Configuration Table
APEOS_CONFIG = {
    "manufacturer": "FUJIFILM",
    "default_model": "Apeos 4620 SZ",
    "enterprise_oid_prefix": ("1.3.6.1.4.1.297", "1.3.6.1.4.1.253"),
    "keywords": [
        "apeos", "4620", "4620 sz", "4620sz", "fujifilm", "fuji xerox", "xerox", "fx apeos"
    ],
    "oids": {
        "sysDescr": "1.3.6.1.2.1.1.1.0",
        "sysObjectID": "1.3.6.1.2.1.1.2.0",
        "sysUpTime": "1.3.6.1.2.1.1.3.0",
        "sysContact": "1.3.6.1.2.1.1.4.0",
        "sysName": "1.3.6.1.2.1.1.5.0",
        "sysLocation": "1.3.6.1.2.1.1.6.0",
        "serialNumber": "1.3.6.1.2.1.43.5.1.1.17.1",
        "printerName": "1.3.6.1.2.1.43.5.1.1.16.1",
        "pageCount": "1.3.6.1.2.1.43.10.2.1.4.1.1",
        "tonerMax": "1.3.6.1.2.1.43.11.1.1.8.1.1",
        "tonerCurrent": "1.3.6.1.2.1.43.11.1.1.9.1.1",
        "drumMax": "1.3.6.1.2.1.43.11.1.1.8.1.2",
        "drumCurrent": "1.3.6.1.2.1.43.11.1.1.9.1.2",
        "consoleText": "1.3.6.1.2.1.43.16.5.1.2.1.1",
        "deviceStatus": "1.3.6.1.2.1.25.3.2.1.5.1",
        "printerStatus": "1.3.6.1.2.1.25.3.5.1.1.1",
    }
}


class ApeosAdapter:
    """Device Adapter specifically tailored for FUJIFILM Apeos 4620 SZ printers."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or APEOS_CONFIG

    def identify(
        self,
        sys_descr: Optional[str] = None,
        sys_object_id: Optional[str] = None,
        snmp_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Check if the responding SNMP device matches FUJIFILM Apeos series."""
        combined_text = ""
        if sys_descr:
            combined_text += f" {sys_descr}"
        if sys_object_id:
            combined_text += f" {sys_object_id}"
        if snmp_data:
            for v in snmp_data.values():
                if isinstance(v, str):
                    combined_text += f" {v}"

        combined_lower = combined_text.lower()

        # Check enterprise OID prefixes
        if sys_object_id:
            for prefix in self.config.get("enterprise_oid_prefix", ()):
                if sys_object_id.startswith(prefix):
                    return True

        # Check keyword matches
        for kw in self.config.get("keywords", []):
            if kw in combined_lower:
                return True

        return False

    def extract_model_name(self, sys_descr: str, snmp_data: Dict[str, Any]) -> str:
        """Extract refined model name e.g. 'Apeos 4620 SZ'."""
        text = sys_descr or ""
        for v in snmp_data.values():
            if isinstance(v, str) and ("Apeos" in v or "4620" in v):
                text += f" {v}"

        match = re.search(r"Apeos\s*(\d+[A-Za-z\s]*)", text, re.IGNORECASE)
        if match:
            raw_model = match.group(0).strip()
            # Standardize 4620 SZ
            if "4620" in raw_model:
                return "Apeos 4620 SZ"
            return raw_model

        if "4620" in text:
            return "Apeos 4620 SZ"

        return self.config.get("default_model", "Apeos 4620 SZ")

    def get_status(self, snmp_data: Dict[str, Any]) -> str:
        """Determine device status (ONLINE, WARNING, ERROR, UNKNOWN)."""
        if not snmp_data:
            return "UNKNOWN"

        consumables = self.get_consumables(snmp_data)
        toner_pct = consumables.get("toner_black_percent")
        drum_pct = consumables.get("drum_percent")

        # Check console / LCD display error messages
        console_text = snmp_data.get(self.config["oids"]["consoleText"].strip("."), "")
        if isinstance(console_text, str):
            c_low = console_text.lower()
            if any(w in c_low for w in ["jam", "error", "cover open", "door open", "empty", "replace"]):
                return "ERROR"
            if any(w in c_low for w in ["low", "warning", "near end", "order"]):
                return "WARNING"

        # Check toner and drum percentages
        if toner_pct is not None:
            if toner_pct <= 0:
                return "ERROR"
            elif toner_pct <= 15:
                return "WARNING"

        if drum_pct is not None:
            if drum_pct <= 0:
                return "ERROR"
            elif drum_pct <= 10:
                return "WARNING"

        return "ONLINE"

    def get_counters(self, snmp_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract page count metrics."""
        page_oid = self.config["oids"]["pageCount"].strip(".")
        raw_count = snmp_data.get(page_oid)
        count = int(raw_count) if isinstance(raw_count, (int, str)) and str(raw_count).isdigit() else 0
        return {
            "total_page_count": count,
            "raw_value": raw_count
        }

    def get_consumables(self, snmp_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate Toner and Drum levels."""
        oids = self.config["oids"]
        toner_max = snmp_data.get(oids["tonerMax"].strip("."))
        toner_cur = snmp_data.get(oids["tonerCurrent"].strip("."))
        drum_max = snmp_data.get(oids["drumMax"].strip("."))
        drum_cur = snmp_data.get(oids["drumCurrent"].strip("."))

        toner_pct = None
        if isinstance(toner_max, int) and isinstance(toner_cur, int) and toner_max > 0:
            toner_pct = max(0, min(100, round((toner_cur / toner_max) * 100)))

        drum_pct = None
        if isinstance(drum_max, int) and isinstance(drum_cur, int) and drum_max > 0:
            drum_pct = max(0, min(100, round((drum_cur / drum_max) * 100)))

        return {
            "toner_black_percent": toner_pct if toner_pct is not None else 0,
            "toner_max": toner_max,
            "toner_current": toner_cur,
            "drum_percent": drum_pct if drum_pct is not None else 0,
            "drum_max": drum_max,
            "drum_current": drum_cur,
        }

    def get_firmware(self, snmp_data: Dict[str, Any]) -> str:
        """Extract firmware version if available from sysDescr or OIDs."""
        sys_descr = snmp_data.get(self.config["oids"]["sysDescr"].strip("."), "")
        if isinstance(sys_descr, str):
            # Look for version numbers e.g. "Ver. 1.2.3" or "v2.0"
            m = re.search(r"(?:ver(?:sion)?\.?|v)\s*([\d\.]+)", sys_descr, re.IGNORECASE)
            if m:
                return m.group(1)
        return ""

    async def get_info(self, ip: str, snmp_service: SNMPService) -> Dict[str, Any]:
        """Fetch complete Apeos information via SNMP."""
        target_oids = list(self.config["oids"].values())
        raw_data = await snmp_service.query(ip, target_oids)

        if not raw_data:
            return {
                "ip_address": ip,
                "status": "OFFLINE",
                "manufacturer": self.config.get("manufacturer", "FUJIFILM"),
                "model": self.config.get("default_model", "Apeos 4620 SZ"),
                "raw_data": {}
            }

        oids = self.config["oids"]
        sys_descr = str(raw_data.get(oids["sysDescr"].strip("."), "") or "")
        sys_name = str(raw_data.get(oids["sysName"].strip("."), "") or "")
        sys_loc = str(raw_data.get(oids["sysLocation"].strip("."), "") or "")
        serial = str(raw_data.get(oids["serialNumber"].strip("."), "") or "N/A")
        prt_name = str(raw_data.get(oids["printerName"].strip("."), "") or sys_name or "")

        model = self.extract_model_name(sys_descr, raw_data)
        consumables = self.get_consumables(raw_data)
        counters = self.get_counters(raw_data)
        status = self.get_status(raw_data)
        firmware = self.get_firmware(raw_data)

        return {
            "ip_address": ip,
            "hostname": sys_name,
            "device_name": prt_name or f"FUJIFILM {model}",
            "manufacturer": "FUJIFILM",
            "model": model,
            "serial_number": serial,
            "location": sys_loc,
            "status": status,
            "page_count": counters["total_page_count"],
            "toner_black": consumables["toner_black_percent"],
            "drum_level": consumables["drum_percent"],
            "firmware_version": firmware,
            "snmp_version": "v2c",
            "web_url": f"http://{ip}",
            "raw_data": raw_data
        }


# Singleton Apeos adapter
apeos_adapter = ApeosAdapter()
