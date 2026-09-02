@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ============================================
echo   SIENTA Tracker  記録の取り込み
echo ============================================
echo.
py "%~dp0tools\merge_data.py" --push
if errorlevel 1 (
  echo.
  echo *** エラーが発生しました ***
)
echo.
pause
