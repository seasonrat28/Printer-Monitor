# Printer-Monitor Workspace Constraints

## 1. Terminal & Scripting
- **STRICT RESTRICTION:** DO NOT use PowerShell (`ps` or `powershell.exe`).
- Only use Command Prompt (`cmd.exe`) or Batch scripts (`.bat`).
- For hidden background processes, use `.vbs` (VBScript) or standard `.bat` workarounds, NOT PowerShell scripts.

## 2. Printer Monitoring & Data Fetching
- **Data Source:** Always fetch printer data via web interface scraping (HTTP), NOT SNMP, across all printer models unless absolutely impossible.
- **Alerts:** DO NOT use LINE Notify integrations.

## 3. UI & Display Rules (Fuji Printers)
- For Fuji/Apeos printers, apply the following strict color logic:
  - **Toner:** Display as Black (⬛).
  - **Drum:** Display as Gray (⬜).
  - **Warning Threshold:** Show Red ONLY when remaining life is <= 10%.
  - **No Yellow:** Do not use Yellow/Amber intermediate warning states for these components.
