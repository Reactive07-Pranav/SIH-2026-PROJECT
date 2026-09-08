#!/bin/bash
# Quick Start Script for Drug Test Evidence System
# Run this from the drug_test_app directory

echo "🚀 Drug Test Evidence System - Quick Start"
echo "=========================================="
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd backend
npm install

echo ""
echo "🌱 Seeding database with test operators..."
npm run seed

echo ""
echo "🔥 Starting backend server..."
npm start &
BACKEND_PID=$!
echo "Backend running on http://localhost:3001 (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 3

cd ..

echo ""
echo "📱 Flutter setup..."
echo "Installing Flutter dependencies..."
flutter pub get

echo ""
echo "✅ Setup complete!"
echo ""
echo "================================"
echo "Next steps:"
echo "================================"
echo ""
echo "1. Start an Android emulator or connect a physical device"
echo "2. Run: flutter run"
echo "3. Login with:"
echo "   - Operator ID: OP001"
echo "   - Password: test123"
echo ""
echo "Backend is running at http://localhost:3000"
echo "To stop backend: kill $BACKEND_PID"
echo ""
echo "📖 See SETUP.md for detailed instructions"
echo "📊 See BUILD_SUMMARY.md for complete documentation"
