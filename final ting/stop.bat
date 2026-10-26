@echo off
title AquaTrace - Stop Servers
echo ================================================================
echo              STOPPING AQUATRACE SERVERS
echo ================================================================
echo.
echo Terminating Backend and Frontend processes...
taskkill /f /t /fi "WINDOWTITLE eq AquaTrace - Backend API*" >nul 2>&1
taskkill /f /t /fi "WINDOWTITLE eq AquaTrace - Frontend Dashboard*" >nul 2>&1
echo.
echo AquaTrace services stopped successfully.
timeout /t 2 >nul 2>&1 || ping -n 3 127.0.0.1 >nul 2>&1
exit /b 0
