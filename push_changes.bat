@echo off
git add backend/app/api/endpoints/printers.py
git add frontend/src/pages/PrintersList.tsx
git add frontend/src/pages/AlertsPage.tsx
git add backend/app/scrapers/canon.py
git commit -m "feat: update printer UI, fix canon scraper, add uptime stats"
git push
echo Changes pushed successfully!
pause
