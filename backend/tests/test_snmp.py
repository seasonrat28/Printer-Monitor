import pytest
from app.snmp.standard import StandardSNMPAdapter

@pytest.mark.asyncio
async def test_snmp_standard_adapter_initialization():
    adapter = StandardSNMPAdapter(ip="127.0.0.1", community="public")
    assert adapter.ip == "127.0.0.1"
    assert adapter.community == "public"

@pytest.mark.parametrize(
    ("description", "expected"),
    [
        ("Fuser Unit", "fuser"),
        ("Laser Unit", "laser"),
        ("PF Kit MP", "pf_kit_mp"),
        ("PF Kit 1", "pf_kit_1"),
        ("Paper Feeding Kit 1", "pf_kit_1"),
        ("Toner Cartridge", "toner"),
        ("Drum Unit", "drum"),
    ],
)
def test_supply_label_mapping(description, expected):
    assert StandardSNMPAdapter._match_supply_category(description) == expected

def test_status_parsing():
    assert StandardSNMPAdapter.__name__ == "StandardSNMPAdapter"
