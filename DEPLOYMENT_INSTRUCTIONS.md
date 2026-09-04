# Deployment & Next Steps for CLI Agent on 10.119.43.25

**⚠️ CRITICAL WARNING FOR THE AGENT ON 10.119.43.25 ⚠️**
DO NOT USE PowerShell (`powershell.exe`) for any commands. PowerShell is explicitly BLOCKED by the Athena EPP Agent on this machine. You MUST use the standard Windows Command Prompt (`cmd.exe`) for all operations.

## Context
The codebase has been updated to fix a critical bug in the `pysnmp` library where SNMP data (Nodename, Serial No., Location, Toner Levels) was not being saved to the database. The bug has been resolved in the GitHub repository.

## Your Tasks on 10.119.43.25

**1. Stop Existing Services**
Before pulling the new code, you must stop any running instances of the application to release file locks (especially `printer_monitor.db` and log files).
Run in CMD:
```cmd
taskkill /F /IM python.exe /T
taskkill /F /IM node.exe /T
```

**2. Sync Latest Code from GitHub**
Ensure the local repository is completely synced with the `main` branch.
Run in CMD:
```cmd
git reset --hard origin/main
git pull origin main
```

**3. Restart the Application**
Run the launcher script to start both Backend and Frontend.
Run in CMD:
```cmd
python scripts/launcher.py restart
```

**4. Verify Network / SNMP Connectivity**
The notebook previously failed to reach the printers (e.g., `10.119.34.70`) via ICMP Ping and SNMP (UDP Port 161). 
- Please verify if `10.119.43.25` can ping the printers.
- Check `logs/backend.log` (using `type logs\backend.log` in CMD) to ensure there are no SNMP Timeout errors. 
- If `10.119.43.25` can successfully communicate with the printers via SNMP, the Web UI will automatically update the IP addresses to display the actual Nodenames (sysName) within 1 minute of starting.

**Note**: Since `10.119.43.25` is acting as the main server, if it still cannot reach `10.119.34.xxx`, you will need to coordinate with the network administrator to allow traffic between these VLANs.
