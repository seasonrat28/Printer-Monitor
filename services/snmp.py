"""SNMP Service Abstraction Layer.
Supports SNMP v1 and SNMP v2c queries with fast pure-Python async BER engine
and standard Printer-MIB definitions.
"""

import asyncio
import socket
import struct
import time
from typing import Any, Dict, List, Optional, Tuple, Union

# Standard MIB-2 and Printer-MIB (RFC 3805 / RFC 1759) OIDs
OIDS = {
    # System MIB (1.3.6.1.2.1.1)
    "sysDescr": "1.3.6.1.2.1.1.1.0",
    "sysObjectID": "1.3.6.1.2.1.1.2.0",
    "sysUpTime": "1.3.6.1.2.1.1.3.0",
    "sysContact": "1.3.6.1.2.1.1.4.0",
    "sysName": "1.3.6.1.2.1.1.5.0",
    "sysLocation": "1.3.6.1.2.1.1.6.0",

    # Printer-MIB General
    "prtGeneralPrinterName": "1.3.6.1.2.1.43.5.1.1.16.1",
    "prtGeneralSerialNumber": "1.3.6.1.2.1.43.5.1.1.17.1",
    
    # Page Count / Marker Life
    "prtMarkerLifeCount": "1.3.6.1.2.1.43.10.2.1.4.1.1",

    # Marker Supplies (Toner & Drum)
    "prtMarkerSuppliesMaxCapacity1": "1.3.6.1.2.1.43.11.1.1.8.1.1",
    "prtMarkerSuppliesLevel1": "1.3.6.1.2.1.43.11.1.1.9.1.1",
    "prtMarkerSuppliesDesc1": "1.3.6.1.2.1.43.11.1.1.6.1.1",

    "prtMarkerSuppliesMaxCapacity2": "1.3.6.1.2.1.43.11.1.1.8.1.2",
    "prtMarkerSuppliesLevel2": "1.3.6.1.2.1.43.11.1.1.9.1.2",
    "prtMarkerSuppliesDesc2": "1.3.6.1.2.1.43.11.1.1.6.1.2",

    # Display / Console
    "prtConsoleDisplayBufferText": "1.3.6.1.2.1.43.16.5.1.2.1.1",
    
    # Device Status
    "hrDeviceStatus": "1.3.6.1.2.1.25.3.2.1.5.1",
    "hrPrinterStatus": "1.3.6.1.2.1.25.3.5.1.1.1",
    "hrPrinterDetectedErrorState": "1.3.6.1.2.1.25.3.5.1.2.1",
}


# ============================================================================
# Pure Python ASN.1 BER Encoder & Decoder for SNMP v1 / v2c
# ============================================================================

def _encode_length(length: int) -> bytes:
    if length < 0x80:
        return bytes([length])
    len_bytes = []
    while length > 0:
        len_bytes.append(length & 0xFF)
        length >>= 8
    len_bytes.reverse()
    return bytes([0x80 | len(len_bytes)] + len_bytes)


def _encode_integer(val: int) -> bytes:
    if val == 0:
        return b"\x02\x01\x00"
    is_neg = val < 0
    raw = []
    if is_neg:
        val = val & 0xFFFFFFFF
    while val > 0 or (len(raw) == 0):
        raw.append(val & 0xFF)
        val >>= 8
    if not is_neg and (raw[-1] & 0x80):
        raw.append(0x00)
    raw.reverse()
    b = bytes(raw)
    return b"\x02" + _encode_length(len(b)) + b


def _encode_octet_string(val: Union[str, bytes]) -> bytes:
    if isinstance(val, str):
        val = val.encode("utf-8")
    return b"\x04" + _encode_length(len(val)) + val


def _encode_null() -> bytes:
    return b"\x05\x00"


def _encode_oid(oid_str: str) -> bytes:
    parts = [int(p) for p in oid_str.strip(".").split(".") if p]
    if len(parts) < 2:
        return b"\x06\x00"
    first_byte = parts[0] * 40 + parts[1]
    encoded = [first_byte]
    for p in parts[2:]:
        if p == 0:
            encoded.append(0)
            continue
        sub = []
        while p > 0:
            sub.append(p & 0x7F)
            p >>= 7
        sub.reverse()
        for i in range(len(sub) - 1):
            sub[i] |= 0x80
        encoded.extend(sub)
    b = bytes(encoded)
    return b"\x06" + _encode_length(len(b)) + b


def _encode_sequence(payload: bytes, tag: int = 0x30) -> bytes:
    return bytes([tag]) + _encode_length(len(payload)) + payload


def _decode_length(data: bytes, offset: int) -> Tuple[int, int]:
    if offset >= len(data):
        return 0, offset
    first = data[offset]
    offset += 1
    if first < 0x80:
        return first, offset
    num_bytes = first & 0x7F
    if offset + num_bytes > len(data):
        return 0, len(data)
    length = 0
    for _ in range(num_bytes):
        length = (length << 8) | data[offset]
        offset += 1
    return length, offset


def _decode_oid(data: bytes) -> str:
    if len(data) == 0:
        return ""
    first = data[0]
    p1 = first // 40
    p2 = first % 40
    parts = [str(p1), str(p2)]
    val = 0
    for b in data[1:]:
        val = (val << 7) | (b & 0x7F)
        if not (b & 0x80):
            parts.append(str(val))
            val = 0
    return ".".join(parts)


def _decode_ber_value(data: bytes, offset: int) -> Tuple[Any, int]:
    if offset >= len(data):
        return None, offset
    tag = data[offset]
    offset += 1
    length, offset = _decode_length(data, offset)
    val_bytes = data[offset:offset + length]
    next_offset = offset + length

    if tag == 0x02:  # INTEGER
        val = 0
        if len(val_bytes) > 0:
            is_neg = bool(val_bytes[0] & 0x80)
            for b in val_bytes:
                val = (val << 8) | b
            if is_neg:
                val -= 1 << (len(val_bytes) * 8)
        return val, next_offset
    elif tag == 0x04:  # OCTET STRING
        try:
            return val_bytes.decode("utf-8", errors="replace"), next_offset
        except Exception:
            return val_bytes.hex(), next_offset
    elif tag == 0x05:  # NULL
        return None, next_offset
    elif tag == 0x06:  # OBJECT IDENTIFIER
        return _decode_oid(val_bytes), next_offset
    elif tag in (0x40, 0x41, 0x42, 0x43, 0x46):  # IpAddress, Counter32, Gauge32, TimeTicks, Counter64
        val = 0
        for b in val_bytes:
            val = (val << 8) | b
        return val, next_offset
    elif tag in (0x80, 0x81, 0x82):  # NoSuchObject, NoSuchInstance, EndOfMibView
        return None, next_offset
    elif tag == 0x30 or (tag & 0xE0) == 0xA0:  # Sequence or PDU
        # Return raw payload for recursive parsing
        return (tag, val_bytes), next_offset
    return val_bytes, next_offset


def build_snmp_get_packet(
    community: str,
    oids: List[str],
    request_id: int = 1,
    version: int = 1  # 0 for v1, 1 for v2c
) -> bytes:
    """Build an SNMP GetRequest UDP packet."""
    # Build VarBindList
    varbinds = []
    for oid in oids:
        encoded_oid = _encode_oid(oid)
        encoded_null = _encode_null()
        varbind = _encode_sequence(encoded_oid + encoded_null)
        varbinds.append(varbind)
    varbind_list = _encode_sequence(b"".join(varbinds))

    # PDU: GetRequest (0xA0)
    pdu_payload = (
        _encode_integer(request_id) +
        _encode_integer(0) +  # error-status
        _encode_integer(0) +  # error-index
        varbind_list
    )
    pdu = _encode_sequence(pdu_payload, tag=0xA0)

    # SNMP Message: Version + Community + PDU
    msg_payload = (
        _encode_integer(version) +
        _encode_octet_string(community) +
        pdu
    )
    return _encode_sequence(msg_payload)


def parse_snmp_response(packet: bytes) -> Dict[str, Any]:
    """Parse SNMP GetResponse packet and return mapping of OID -> Value."""
    results: Dict[str, Any] = {}
    if not packet or len(packet) < 4:
        return results

    try:
        tag, (msg_tag, msg_body) = _decode_ber_value(packet, 0)
        # Sequence contains: version, community, PDU
        offset = 0
        version, offset = _decode_ber_value(msg_body, offset)
        community, offset = _decode_ber_value(msg_body, offset)
        pdu_info, offset = _decode_ber_value(msg_body, offset)

        if not isinstance(pdu_info, tuple):
            return results
        pdu_tag, pdu_body = pdu_info
        if pdu_tag != 0xA2:  # GetResponse PDU tag
            return results

        pdu_offset = 0
        req_id, pdu_offset = _decode_ber_value(pdu_body, pdu_offset)
        err_status, pdu_offset = _decode_ber_value(pdu_body, pdu_offset)
        err_index, pdu_offset = _decode_ber_value(pdu_body, pdu_offset)
        varbind_seq, pdu_offset = _decode_ber_value(pdu_body, pdu_offset)

        if isinstance(varbind_seq, tuple):
            v_tag, v_bytes = varbind_seq
            v_offset = 0
            while v_offset < len(v_bytes):
                vb_item, v_offset = _decode_ber_value(v_bytes, v_offset)
                if isinstance(vb_item, tuple):
                    _, vb_data = vb_item
                    item_off = 0
                    oid_val, item_off = _decode_ber_value(vb_data, item_off)
                    res_val, item_off = _decode_ber_value(vb_data, item_off)
                    if isinstance(oid_val, str):
                        results[oid_val] = res_val
    except Exception:
        pass

    return results


# ============================================================================
# SNMPService Class
# ============================================================================

class SNMPService:
    """SNMP Service with async & sync query support."""

    def __init__(
        self,
        default_community: str = "public",
        timeout: float = 1.5,
        retries: int = 1,
        port: int = 161
    ):
        self.default_community = default_community
        self.timeout = timeout
        self.retries = retries
        self.port = port
        self._request_counter = 100

    def _next_request_id(self) -> int:
        self._request_counter = (self._request_counter + 1) & 0x7FFFFFFF
        return self._request_counter

    def query_sync(
        self,
        ip: str,
        oids: List[str],
        community: Optional[str] = None,
        timeout: Optional[float] = None,
        retries: Optional[int] = None,
        version: int = 1  # 1 = v2c
    ) -> Dict[str, Any]:
        """Perform a synchronous SNMP Get query over UDP."""
        comm = community or self.default_community
        tout = timeout if timeout is not None else self.timeout
        r_count = retries if retries is not None else self.retries

        if not oids:
            return {}

        req_id = self._next_request_id()
        packet = build_snmp_get_packet(comm, oids, request_id=req_id, version=version)

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(tout)

        try:
            for attempt in range(r_count + 1):
                try:
                    sock.sendto(packet, (ip, self.port))
                    data, _ = sock.recvfrom(65535)
                    parsed = parse_snmp_response(data)
                    if parsed:
                        return parsed
                except socket.timeout:
                    continue
                except Exception:
                    break
        finally:
            sock.close()

        return {}

    async def query(
        self,
        ip: str,
        oids: List[str],
        community: Optional[str] = None,
        timeout: Optional[float] = None,
        retries: Optional[int] = None,
        version: int = 1
    ) -> Dict[str, Any]:
        """Perform an asynchronous SNMP Get query."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            self.query_sync,
            ip,
            oids,
            community,
            timeout,
            retries,
            version
        )

    async def get_single(
        self,
        ip: str,
        oid: str,
        community: Optional[str] = None,
        timeout: Optional[float] = None
    ) -> Any:
        """Fetch a single OID value safely. Returns None if missing or unreadable."""
        res = await self.query(ip, [oid], community=community, timeout=timeout)
        # Match exact OID or prefix
        clean_oid = oid.strip(".")
        for k, v in res.items():
            if k == clean_oid or k.endswith(clean_oid):
                return v
        return res.get(clean_oid, None)

    async def get_system_info(self, ip: str, community: Optional[str] = None) -> Dict[str, Any]:
        """Fetch standard system MIB information."""
        target_oids = [
            OIDS["sysDescr"],
            OIDS["sysObjectID"],
            OIDS["sysUpTime"],
            OIDS["sysContact"],
            OIDS["sysName"],
            OIDS["sysLocation"],
        ]
        raw = await self.query(ip, target_oids, community=community)
        return {
            "sysDescr": raw.get(OIDS["sysDescr"].strip("."), None),
            "sysObjectID": raw.get(OIDS["sysObjectID"].strip("."), None),
            "sysUpTime": raw.get(OIDS["sysUpTime"].strip("."), None),
            "sysContact": raw.get(OIDS["sysContact"].strip("."), None),
            "sysName": raw.get(OIDS["sysName"].strip("."), None),
            "sysLocation": raw.get(OIDS["sysLocation"].strip("."), None),
        }

    async def get_standard_printer_info(self, ip: str, community: Optional[str] = None) -> Dict[str, Any]:
        """Fetch standard Printer-MIB values."""
        target_oids = list(OIDS.values())
        raw = await self.query(ip, target_oids, community=community)

        # Helper to extract value
        def val(k: str) -> Any:
            return raw.get(OIDS[k].strip("."), None)

        toner_max = val("prtMarkerSuppliesMaxCapacity1")
        toner_cur = val("prtMarkerSuppliesLevel1")
        drum_max = val("prtMarkerSuppliesMaxCapacity2")
        drum_cur = val("prtMarkerSuppliesLevel2")

        toner_pct = None
        if isinstance(toner_max, int) and isinstance(toner_cur, int) and toner_max > 0:
            toner_pct = max(0, min(100, round((toner_cur / toner_max) * 100)))

        drum_pct = None
        if isinstance(drum_max, int) and isinstance(drum_cur, int) and drum_max > 0:
            drum_pct = max(0, min(100, round((drum_cur / drum_max) * 100)))

        return {
            "name": val("prtGeneralPrinterName") or val("sysName"),
            "serial": val("prtGeneralSerialNumber"),
            "page_count": val("prtMarkerLifeCount"),
            "toner_max": toner_max,
            "toner_current": toner_cur,
            "toner_percent": toner_pct,
            "drum_max": drum_max,
            "drum_current": drum_cur,
            "drum_percent": drum_pct,
            "display": val("prtConsoleDisplayBufferText"),
            "raw": raw
        }


# Singleton service
snmp_service = SNMPService()
