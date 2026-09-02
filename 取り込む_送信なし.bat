@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 取り込みのみ実行します（GitHubへは送りません）
echo.
py "%~dp0tools\merge_data.py"
echo.
pause
