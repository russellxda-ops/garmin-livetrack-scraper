#!/usr/bin/env bash
# exit on error
set -o errexit

echo "=== Installing npm dependencies ==="
npm install

echo "=== Installing Chrome for Puppeteer ==="
# Set cache to a project-internal directory that persists
export PUPPETEER_CACHE_DIR="$PWD/.puppeteer-cache"
mkdir -p "$PUPPETEER_CACHE_DIR"
npx puppeteer browsers install chrome

echo "=== Verifying Chrome installation ==="
npx puppeteer browsers list

echo "=== Build complete ==="
