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

APP_NAME="desktop-prompter.app"
BUILD_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/macos/$APP_NAME"
INSTALL_PATH="/Applications/$APP_NAME"

# Check if built app exists
if [ ! -d "$BUILD_PATH" ]; then
    print_error "Built app not found at: $BUILD_PATH"
    print_info "Run ./scripts/build.sh first to build the app."
    exit 1
fi

print_info "Installing $APP_NAME to /Applications..."

# Kill the app if it's running
if pgrep -x "desktop-prompter" > /dev/null; then
    print_info "Closing running instance..."
    pkill -x "desktop-prompter" || true
    sleep 1
fi

# Remove existing installation
if [ -d "$INSTALL_PATH" ]; then
    print_info "Removing existing installation..."
    rm -rf "$INSTALL_PATH"
fi

# Copy new version
cp -R "$BUILD_PATH" "$INSTALL_PATH"

print_success "Installed to $INSTALL_PATH"
