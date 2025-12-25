#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_info "Installing npm dependencies..."
    npm install
fi

# Build the Tauri app
print_info "Building Tauri app..."
npm run tauri build

print_success "Build completed!"
print_info "Built app located at: src-tauri/target/release/bundle/macos/desktop-prompter.app"
