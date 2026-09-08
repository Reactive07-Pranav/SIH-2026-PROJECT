@echo off
REM Quick Start Script for Drug Test Evidence System (Windows)
REM Run this from the drug_test_app directory

echo.
echo ========================================
echo Drug Test Evidence System - Quick Start
echo ========================================
echo.

REM Backend setup
echo [Backend Setup]
cd backend
call npm install

echo.
echo [Database Seeding]
call npm run seed

echo.
echo [Starting Backend Server]
start "DrugTest Backend" cmd /k npm start

cd ..

echo.
echo [Flutter Setup]
echo Installing Flutter dependencies...
call flutter pub get

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Start an Android emulator or connect a physical device
echo 2. Run: flutter run
echo 3. Login with:
echo    - Operator ID: OP001
echo    - Password: test123
echo.
echo Backend is running at http://localhost:3001
echo Backend server window opened in new terminal
echo.
echo See SETUP.md for detailed instructions
echo See BUILD_SUMMARY.md for complete documentation
echo.
pause
