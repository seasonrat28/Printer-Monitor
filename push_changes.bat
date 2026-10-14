@echo off
echo ==============================================
echo  Enterprise Printer Monitor - Git Push Script
echo ==============================================
echo.

REM 1. Show current git status
echo [1/4] Checking Git Status...
git status
echo.

REM 2. Stage updated files
echo [2/4] Staging modified files...
git add frontend/src/App.tsx
git add backend/app/scrapers/epson.py
git add -u
git add push_changes.bat
echo.

REM 3. Commit changes
echo [3/4] Committing changes...
git commit -m "feat(ui): update logo to Enterprise Printer Monitor and sync scrapers"
echo.

REM 4. Push to remote
echo [4/4] Pushing to GitHub (origin/main)...
git push origin main
echo.

if %ERRORLEVEL% EQU 0 (
    echo ==============================================
    echo [SUCCESS] Changes pushed to GitHub successfully!
    echo ==============================================
) else (
    echo ==============================================
    echo [ERROR] Git push encountered an issue.
    echo Please check the error message above.
    echo ==============================================
)

pause
