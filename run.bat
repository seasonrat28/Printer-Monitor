@echo off
title Printer Monitor Server
cd /d "%~dp0"

echo Starting Printer Monitor Server...
start "" node server.js

echo Waiting for server to start...
timeout /t 3 >nul

echo Opening Browser...
start "" "http://localhost:3000"

exit