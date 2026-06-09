@echo off
rem OtakuPulse 開発ランチャ: Node サーバ(5180) + Vite dev(1420) を並行起動。
rem Vite が SPA を配信し /api・/events を 5180 に proxy する（HMR 有効）。
cd /d "%~dp0.."
start "OtakuPulse API" cmd /k "cd server && node --watch src/server.ts"
start "OtakuPulse Web (Vite)" cmd /k "pnpm dev"
timeout /t 4 >nul
start "" http://localhost:1420
