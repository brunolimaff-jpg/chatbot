@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Chatbot Launcher
echo ==========================================
echo [1] Sandbox (sem WhatsApp)
echo [2] WhatsApp (pareamento real)
echo.
set /p MODE=Escolha o modo (1 ou 2): 

if "%MODE%"=="1" goto sandbox
if "%MODE%"=="2" goto whatsapp

echo Opcao invalida.
pause
exit /b 1

:sandbox
set "DOTENV_CONFIG_PATH=.env.sandbox"
set "CHATBOT_CHANNEL_MODE=sandbox"
echo Iniciando em SANDBOX com .env.sandbox...
call npm run dev
goto end

:whatsapp
set "DOTENV_CONFIG_PATH=.env.whatsapp"
set "CHATBOT_CHANNEL_MODE=whatsapp"
echo Iniciando em WHATSAPP com .env.whatsapp...
call npm run dev
goto end

:end
pause
endlocal
