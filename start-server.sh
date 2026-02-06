#!/bin/bash

echo "========================================"
echo " Twitter Bookmarks Analyst - Server"
echo "========================================"
echo

cd "$(dirname "$0")/server"

echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "Node.js version: $(node --version)"

echo
echo "Checking if dependencies are installed..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies!"
        exit 1
    fi
fi

echo
echo "Starting server..."
echo "Dashboard will be available at: http://localhost:3000/dashboard"
echo
npm run dev
