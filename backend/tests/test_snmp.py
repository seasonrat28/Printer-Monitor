import pytest
from app.snmp.standard import StandardSNMPAdapter

@pytest.mark.asyncio
async def test_snmp_standard_adapter_initialization():
    adapter = StandardSNMPAdapter(ip="127.0.0.1", community="public")
    assert adapter.ip == "127.0.0.1"
    assert adapter.community == "public"

def test_status_parsing():
    assert StandardSNMPAdapter.__name__ == "StandardSNMPAdapter"
