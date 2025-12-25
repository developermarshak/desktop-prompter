#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if version argument is provided
if [ -z "$1" ]; then
    print_error "Version argument required"
    echo "Usage: ./scripts/release.sh <version>"
    echo "Example: ./scripts/release.sh 0.2.0"
    exit 1
fi

VERSION=$1

# Validate git status
if [ -n "$(git status --porcelain)" ]; then
    print_error "Working directory is not clean. Commit or stash changes first."
    exit 1
fi

print_success "Working directory is clean"

# Validate we're on main branch (optional, can be removed)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_info "Not on main branch (currently on $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Pull latest changes
print_info "Pulling latest changes..."
git pull

# Bump version
print_info "Bumping version to $VERSION..."
node scripts/bump-version.js "$VERSION"

# Run tests (if you have any)
print_info "Running frontend build test..."
npm run build

print_info "Running Rust checks..."
cd src-tauri
cargo check
cd ..

# Commit version bump
print_info "Committing version bump..."
git add -A
git commit -m "chore: bump version to $VERSION"

# Create tag
print_info "Creating tag v$VERSION..."
git tag "v$VERSION"

print_success "Release v$VERSION prepared successfully!"
echo ""
print_info "To publish this release:"
echo "  git push && git push --tags"
echo ""
print_info "This will trigger the GitHub Actions workflow to build and publish the release."
