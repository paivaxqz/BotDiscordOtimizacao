@echo off
set /p msg="Digite a mensagem do commit: "
if "%msg%"=="" set msg=update: small changes

REM Tentar usar o git do PATH ou o caminho padrao
set GIT_CMD=git
if exist "C:\Program Files\Git\cmd\git.exe" set GIT_CMD="C:\Program Files\Git\cmd\git.exe"

echo.
echo 🚀 Configurando git e usuario...
echo.

REM Configura usuario local para evitar erro de identidade
%GIT_CMD% config --local user.email "bot@otimizacao.local"
%GIT_CMD% config --local user.name "Otimizacao Bot"

REM Garante que estamos na branch main
%GIT_CMD% branch -M main

echo.
echo 🚀 Adicionando arquivos e fazendo commit...
echo.

%GIT_CMD% add .
%GIT_CMD% commit -m "%msg%"

echo.
echo 🚀 Enviando para o GitHub (Forcando atualizacao)...
echo.

%GIT_CMD% push -u origin main --force

echo.
echo ✅ Processo finalizado!
pause
