#!/bin/bash
# test/smoke-test.sh - Basic smoke test for WASM build

set -euo pipefail

echo "Running smoke tests..."

# Test 1: WASM file exists and has reasonable size
if [ ! -f xmldot.wasm ]; then
    echo "❌ FAILED: xmldot.wasm not found"
    exit 1
fi

SIZE=$(stat -f%z xmldot.wasm 2>/dev/null || stat -c%s xmldot.wasm)
if [ "$SIZE" -lt 3000000 ] || [ "$SIZE" -gt 5000000 ]; then
    echo "❌ FAILED: WASM size $SIZE outside expected range [3MB-5MB]"
    exit 1
fi
echo "✓ WASM file size: $SIZE bytes"

# Test 2: wasm_exec.js exists
if [ ! -f wasm_exec.js ]; then
    echo "❌ FAILED: wasm_exec.js not found"
    exit 1
fi
echo "✓ wasm_exec.js found"

# Test 3: index.html has SRI attribute
if ! grep -q 'integrity="sha384-' index.html; then
    echo "❌ FAILED: SRI hash not found in index.html"
    exit 1
fi
echo "✓ SRI hash present in index.html"

# Test 4: CSP headers present
if ! grep -q 'Content-Security-Policy' index.html; then
    echo "❌ FAILED: CSP header not found in index.html"
    exit 1
fi
echo "✓ CSP meta tag present"

echo "✅ All smoke tests passed"
