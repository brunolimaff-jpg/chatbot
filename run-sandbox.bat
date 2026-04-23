@echo off
setlocal
cd /d "%~dp0"
set "DOTENV_CONFIG_PATH=.env.sandbox"
set "CHATBOT_CHANNEL_MODE=sandbox"
call npm run dev
pause
endlocal
