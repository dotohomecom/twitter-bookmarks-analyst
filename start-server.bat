@echo off
echo ========================================
echo  Twitter Bookmarks Analyst - Server
echo ========================================
echo.

cd /d "%~dp0server"

echo Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version

echo.
echo Checking if dependencies are installed...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
)

echo.
echo Starting server...
echo Dashboard will be available at: http://localhost:3000/dashboard
echo.
call npm run dev

pause
