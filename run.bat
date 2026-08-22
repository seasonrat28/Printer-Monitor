@echo off
title Printer Monitor Server (FUJIFILM Apeos 4620 SZ)
cd /d "%~dp0"

echo =======================================================
echo Starting FUJIFILM Apeos Printer Management Server...
echo =======================================================
start "" python main.py

echo Waiting for server to initialize...
timeout /t 3 >nul

echo Opening Web Dashboard...
start "" "http://localhost:3000"

exit