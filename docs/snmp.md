# SNMP Implementation

## Parser Engine
The system uses `pysnmp` to poll devices over SNMPv1 and SNMPv2c.

## OID Mapping
- **HostResources MIB (`hrDeviceDescr`)**: Printer model information.
- **Printer MIB (`prtMarkerSuppliesLevel`, `prtMarkerSuppliesMaxCapacity`)**: Toner/Ink levels.
- **System MIB (`sysUpTime`)**: Uptime and connectivity checks.

## Extensibility
The `app/snmp/` directory contains an adapter pattern for standard and vendor-specific SNMP implementations. The `StandardSNMPAdapter` serves as the baseline for standard network printers.
