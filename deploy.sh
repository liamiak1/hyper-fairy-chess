#!/bin/bash
# Deploy script - ensures changes are committed before deploying

set -e

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo "ERROR: You have uncommitted changes!"
    echo ""
    git status --short
    echo ""
    echo "Please commit your changes before deploying."
    exit 1
fi

# Check if local is ahead of remote
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")

if [[ -n "$REMOTE" && "$LOCAL" != "$REMOTE" ]]; then
    echo "WARNING: Local branch is not in sync with remote."
    echo "Pushing changes..."
    git push
fi

echo "All changes committed and pushed. Railway will auto-deploy from GitHub."
