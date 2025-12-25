#!/bin/bash

set -e

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run build
"$SCRIPT_DIR/build.sh"

# Run install
"$SCRIPT_DIR/install.sh"
