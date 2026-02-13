@echo off
set "msg=%~1"
if "%msg%"=="" set "msg=auto: update from agent"

REM Locate git
set GIT_CMD=git
if exist "C:\Program Files\Git\cmd\git.exe" set GIT_CMD="C:\Program Files\Git\cmd\git.exe"

REM Configure user locally just in case
%GIT_CMD% config --local user.email "bot@otimizacao.local"
%GIT_CMD% config --local user.name "Otimizacao Bot"

REM Add, Commit, Push
echo 🚀 Auto-deploying to GitHub...
%GIT_CMD% add .
%GIT_CMD% commit -m "%msg%"
%GIT_CMD% push origin main --force
if %errorlevel% neq 0 (
    echo ❌ Push failed, retrying with pull --rebase...
    %GIT_CMD% pull --rebase origin main
    %GIT_CMD% push origin main
)
echo ✅ Deployed!
