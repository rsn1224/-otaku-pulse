@echo off
rem OtakuPulse 本番ランチャ: SPA をビルド(初回のみ)し、Node サーバを起動してブラウザで開く。
rem 単一ポート(5180)で SPA + /api + /events を配信する。Tauri / exe / WebView2 不要。
setlocal
cd /d "%~dp0.."

if not exist "dist\index.html" (
  echo [OtakuPulse] Building web UI ^(first run^)...
  call pnpm build || (echo [OtakuPulse] build failed & pause & exit /b 1)
)

echo [OtakuPulse] Starting server on http://localhost:5180 ...
cd server
set "COLLECT_ON_START=1"
start "OtakuPulse" /min cmd /c "node src/server.ts"
cd ..

timeout /t 3 >nul
start "" http://localhost:5180
endlocal
