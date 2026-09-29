@echo off
setlocal EnableDelayedExpansion
title OS e E-mails
cd /d "%~dp0"

set "NODE_EXE="

rem ---- 1) Node instalado no PATH -------------------------------------------
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"

rem ---- 2) Node portatil que fica junto deste workspace (se existir) --------
if not defined NODE_EXE if exist "%~dp0..\.toolchain\node\node.exe" for %%I in ("%~dp0..\.toolchain\node\node.exe") do set "NODE_EXE=%%~fI"

rem ---- 3) Locais padrao de instalacao no Windows ---------------------------
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE_EXE (
  echo.
  echo [ERRO] Node.js nao foi encontrado neste computador.
  echo.
  echo Baixe a versao LTS em https://nodejs.org e instale ^(Next, Next, Finish^).
  echo Depois rode este arquivo novamente.
  echo.
  pause
  exit /b 1
)

for %%I in ("%NODE_EXE%") do set "NODE_HOME=%%~dpI"
set "PATH=%NODE_HOME%;%PATH%"

echo ===========================================================
echo  Sistema de OS e E-mails
echo ===========================================================
node --version
call npm --version
echo -----------------------------------------------------------

if /i "%~1"=="--check" (
  echo [check] Node encontrado em: %NODE_EXE%
  exit /b 0
)

rem ---- Dependencias ---------------------------------------------------------
if not exist "node_modules" (
  echo [1/3] Instalando dependencias ^(pode demorar alguns minutos^)...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo.
    echo [aviso] A instalacao falhou. Tentando novamente sem validacao de
    echo         certificado, o que costuma resolver redes corporativas...
    call npm install --no-fund --no-audit --strict-ssl=false
  )
  if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel instalar as dependencias. Veja o README.md
    echo        na secao "Problemas comuns".
    pause
    exit /b 1
  )
) else (
  echo [1/3] Dependencias ja instaladas.
)

rem ---- Build ---------------------------------------------------------------
if not exist "web\dist\index.html" (
  echo [2/3] Gerando o build do site e da API...
  call npm run build
  if errorlevel 1 (
    echo [ERRO] Falha no build. Veja as mensagens acima.
    pause
    exit /b 1
  )
) else (
  echo [2/3] Build ja gerado.
)

rem ---- Sobe o sistema ------------------------------------------------------
echo [3/3] Iniciando o sistema em http://localhost:3000
echo       ^(feche esta janela ou pressione Ctrl+C para parar^)
start "" http://localhost:3000
call npm start

pause
