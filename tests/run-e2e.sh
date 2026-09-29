#!/bin/sh
# Serves public/ on :8765 and runs all scenarios against the Auth + Firestore emulators.
set -e
# In containers with a preinstalled Chromium set CHROMIUM_PATH to it.
cd "$(dirname "$0")"
python3 -m http.server 8765 --directory ../public >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
npx firebase emulators:exec --only auth,firestore --project linkage-massege "node e2e/all.cjs"
