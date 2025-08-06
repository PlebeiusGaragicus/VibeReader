#!/bin/bash

# VibeReader Test Script
# Increments build number and starts the development server

echo "🚀 VibeReader Test Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Increment build number
./increment-build.sh

echo ""
echo "🌐 Starting development server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start the server
./start-server.sh
