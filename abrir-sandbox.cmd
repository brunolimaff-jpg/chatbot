@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "APP_NAME=Maeve Chat Sandbox"
set "SANDBOX_PORT=3008"

if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"PORT=" ".env"`) do (
        if not "%%B"=="" set "SANDBOX_PORT=%%B"
    )
)

set "SANDBOX_URL=http://localhost:%SANDBOX_PORT%/sandbox"
set "HEALTH_URL=http://localhost:%SANDBOX_PORT%/health"

echo.
echo ==========================================
echo  %APP_NAME%
echo ==========================================
echo.
echo Este inicializador confere os pre-requisitos,
echo instala dependencias do projeto e abre o sandbox.
echo.

where node > nul 2> nul
if errorlevel 1 goto :install_node

where npm > nul 2> nul
if errorlevel 1 goto :install_node

echo Node.js encontrado:
node --version
echo npm encontrado:
call npm --version
goto :check_env

:install_node
echo Node.js/npm nao encontrados.
echo Tentando instalar Node.js LTS via winget...

where winget > nul 2> nul
if errorlevel 1 (
    echo.
    echo O winget nao esta disponivel nesta maquina.
    echo Instale o Node.js LTS manualmente e execute este arquivo novamente:
    echo https://nodejs.org/
    start "" "https://nodejs.org/"
    goto :fail
)

winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo.
    echo Nao foi possivel instalar o Node.js automaticamente.
    echo Instale o Node.js LTS manualmente e execute este arquivo novamente:
    echo https://nodejs.org/
    start "" "https://nodejs.org/"
    goto :fail
)

set "PATH=%ProgramFiles%\nodejs;%AppData%\npm;%PATH%"

where node > nul 2> nul
if errorlevel 1 (
    echo.
    echo Node.js foi instalado, mas ainda nao apareceu no PATH desta janela.
    echo Feche este terminal e execute abrir-sandbox.cmd novamente.
    goto :fail
)

where npm > nul 2> nul
if errorlevel 1 (
    echo.
    echo npm nao foi encontrado apos instalar Node.js.
    echo Feche este terminal e execute abrir-sandbox.cmd novamente.
    goto :fail
)

echo Node.js instalado:
node --version
echo npm instalado:
call npm --version

:check_env
if not exist ".env" (
    echo.
    echo Arquivo .env nao encontrado.
    echo Crie um .env na raiz do projeto com GEMINI_API_KEY e as configuracoes do sandbox.
    echo Exemplo minimo:
    echo GEMINI_API_KEY=sua_chave_aqui
    echo PORT=3008
    echo CHATBOT_CHANNEL_MODE=sandbox
    echo GEMINI_MODEL=models/gemini-3.1-flash-lite-preview
    echo GEMINI_FALLBACK_MODEL=gemini-2.5-pro
    goto :fail
)

findstr /b /c:"GEMINI_API_KEY=" ".env" > nul 2> nul
if errorlevel 1 (
    echo.
    echo GEMINI_API_KEY nao encontrada no .env.
    echo Adicione sua chave antes de iniciar o sandbox com IA.
    goto :fail
)

findstr /b /c:"CHATBOT_CHANNEL_MODE=sandbox" ".env" > nul 2> nul
if errorlevel 1 (
    echo.
    echo Aviso: CHATBOT_CHANNEL_MODE=sandbox nao foi encontrado no .env.
    echo O sandbox pode nao iniciar como esperado.
)

:check_dependencies
if exist "node_modules" (
    echo Dependencias ja encontradas em node_modules.
    goto :check_existing_server
)

echo.
echo Instalando dependencias do projeto...
if exist "package-lock.json" (
    call npm ci
) else (
    call npm install
)

if errorlevel 1 (
    echo.
    echo Falha ao instalar dependencias npm.
    goto :fail
)

:check_existing_server
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri '%HEALTH_URL%' -TimeoutSec 2 | Out-Null; 'running' } catch {}"`) do (
    if "%%A"=="running" (
        echo Sandbox ja esta rodando em %SANDBOX_URL%.
        goto :open_browser
    )
)

for /f "usebackq tokens=5" %%A in (`netstat -ano ^| findstr /r /c:":%SANDBOX_PORT% .*LISTENING"`) do (
    echo.
    echo A porta %SANDBOX_PORT% ja esta em uso pelo processo %%A, mas o sandbox nao respondeu.
    echo Feche esse processo ou altere PORT no .env.
    goto :fail
)

echo.
echo Iniciando servidor local em uma nova janela...
start "%APP_NAME%" cmd /k "title %APP_NAME% && cd /d ""%~dp0"" && npm run dev"

echo Aguardando o servidor subir...
for /l %%I in (1,1,30) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri '%HEALTH_URL%' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" > nul 2> nul
    if not errorlevel 1 goto :open_browser
    timeout /t 1 /nobreak > nul
)

echo.
echo O servidor ainda nao respondeu em %SANDBOX_URL%.
echo Confira a janela "%APP_NAME%" para ver o erro completo.
echo Se aparecer EADDRINUSE, a porta %SANDBOX_PORT% ja esta em uso.
goto :fail

:open_browser
echo Abrindo %SANDBOX_URL%
start "" "%SANDBOX_URL%"

echo.
echo Pronto. Sandbox disponivel em %SANDBOX_URL%
echo.
pause
exit /b 0

:fail
echo.
echo Nao foi possivel iniciar o sandbox.
echo Corrija o item acima e execute abrir-sandbox.cmd novamente.
echo.
pause
exit /b 1
