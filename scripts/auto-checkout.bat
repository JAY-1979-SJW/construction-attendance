@echo off
cd /d C:\Users\skyjw\construction-attendance
npx dotenv -e .env -- npx tsx scripts/run-auto-checkout.ts >> logs\auto-checkout.log 2>&1
