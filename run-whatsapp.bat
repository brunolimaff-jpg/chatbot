@echo off
setlocal
cd /d "%~dp0"
set "DOTENV_CONFIG_PATH=.env.whatsapp"
set "CHATBOT_CHANNEL_MODE=whatsapp"
call npm run dev
pause
endlocal
