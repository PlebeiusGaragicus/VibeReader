#!/bin/bash

# VibeReader Local Development Server
# This script starts a Python HTTP server for testing VibeReader locally

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT=8080
HOST="localhost"

echo -e "${BLUE}🚀 Starting VibeReader Development Server${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo -e "${RED}❌ Error: index.html not found in current directory${NC}"
    echo -e "${YELLOW}Please run this script from the VibeReader project directory${NC}"
    exit 1
fi

# Check Python version and start appropriate server
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    echo -e "${GREEN}✅ Using Python 3${NC}"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    echo -e "${GREEN}✅ Using Python 2${NC}"
else
    echo -e "${RED}❌ Error: Python not found${NC}"
    echo -e "${YELLOW}Please install Python to run the development server${NC}"
    exit 1
fi

# Display server information
echo -e "${BLUE}📍 Server Details:${NC}"
echo -e "   Host: ${GREEN}${HOST}${NC}"
echo -e "   Port: ${GREEN}${PORT}${NC}"
echo -e "   URL:  ${GREEN}http://${HOST}:${PORT}${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Function to handle cleanup on script exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down server...${NC}"
    echo -e "${GREEN}✅ Server stopped. Thanks for using VibeReader!${NC}"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}🌐 Starting HTTP server...${NC}"
echo -e "${BLUE}📝 Server logs will appear below:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Start the server with enhanced logging
if [ "$PYTHON_CMD" = "python3" ]; then
    # Python 3 version with enhanced logging
    $PYTHON_CMD -c "
import http.server
import socketserver
import os
import datetime
from urllib.parse import unquote

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f'[{timestamp}] {format % args}')
    
    def do_GET(self):
        # Log the request with more details
        client_ip = self.client_address[0]
        path = unquote(self.path)
        print(f'📥 GET {path} from {client_ip}')
        super().do_GET()
    
    def do_POST(self):
        # Log POST requests (useful for future API endpoints)
        client_ip = self.client_address[0]
        path = unquote(self.path)
        print(f'📤 POST {path} from {client_ip}')
        super().do_POST()

# Change to the script directory
os.chdir('$(pwd)')

# Start server
with socketserver.TCPServer(('$HOST', $PORT), CustomHTTPRequestHandler) as httpd:
    print(f'🚀 Server running at http://$HOST:$PORT/')
    print(f'📁 Serving files from: {os.getcwd()}')
    print(f'🔄 Press Ctrl+C to stop the server')
    print('━' * 50)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n🛑 Server stopped by user')
"
else
    # Python 2 fallback
    echo -e "${YELLOW}⚠️  Using Python 2 - limited logging available${NC}"
    $PYTHON_CMD -m SimpleHTTPServer $PORT
fi
