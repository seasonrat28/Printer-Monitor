@echo off
taskkill /F /IM python.exe /T
taskkill /F /IM node.exe /T
git reset --hard origin/main
git pull origin main
python scripts/launcher.py restart
ping 127.0.0.1 -n 11 > nul